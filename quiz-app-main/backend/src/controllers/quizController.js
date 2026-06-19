const config = require('../config');
const { QuizSession, Question, Score, User } = require('../models');
const { emitLeaderboardUpdated } = require('../realtime/socket');
const { evaluateSuspicion } = require('../utils/cheatDetection');
const { applyProgression } = require('../utils/learning');

const DIFF_ORDER = ['easy', 'medium', 'hard'];

const clamp = (n, min, max) => Math.max(min, Math.min(max, n));

const normalize = (v) => (typeof v === 'string' ? v.trim().toLowerCase() : '');

const buildScorePayload = (scoreRecord) => ({
  _id: scoreRecord._id,
  score: scoreRecord.score,
  maxScore: scoreRecord.maxScore,
  totalQuestions: scoreRecord.totalQuestions,
  correctAnswers: scoreRecord.correctAnswers,
  percentage: scoreRecord.percentage,
  category: scoreRecord.category,
  difficulty: scoreRecord.difficulty,
  completedAt: scoreRecord.completedAt
});

const finalizeSession = async (session, userId) => {
  const percentage = session.targetCount > 0
    ? Math.round((session.correctAnswers / session.targetCount) * 100)
    : 0;

  const suspicion = evaluateSuspicion({
    violations: session.violations,
    percentage,
    totalQuestions: session.targetCount,
    timeTaken: session.asked.reduce((sum, q) => sum + (q.timeSpent || 0), 0)
  });

  const allIds = session.asked.map(a => a.questionId);
  const allQuestions = await Question.find({ _id: { $in: allIds } })
    .select('question options correctAnswer explanation points')
    .lean();
  const qMap = new Map(allQuestions.map(q => [q._id.toString(), q]));

  const scoreRecord = await Score.create({
    user: userId,
    score: session.score,
    maxScore: session.maxScore,
    totalQuestions: session.targetCount,
    correctAnswers: session.correctAnswers,
    category: session.category,
    difficulty: 'mixed',
    timeTaken: session.asked.reduce((sum, q) => sum + (q.timeSpent || 0), 0),
    percentage,
    violations: session.violations,
    suspicious: suspicion.suspicious,
    suspiciousReasons: suspicion.reasons,
    questions: session.asked.map((a) => {
      const q = qMap.get(a.questionId.toString());
      return {
        questionId: a.questionId,
        topic: q?.topic || 'General',
        questionText: q?.question,
        options: q?.options,
        userAnswer: a.userAnswer,
        correctAnswer: q?.correctAnswer,
        explanation: q?.explanation,
        isCorrect: a.isCorrect,
        timeSpent: a.timeSpent,
        points: q?.points || a.points,
        pointsEarned: a.pointsEarned
      };
    })
  });

  const user = await User.findById(userId);
  const profile = user?.profile || { totalQuizzes: 0, averageScore: 0, highestScore: 0 };
  const newTotalQuizzes = (profile.totalQuizzes || 0) + 1;
  const newAverageScore = Math.round(((profile.averageScore || 0) * (profile.totalQuizzes || 0) + session.score) / newTotalQuizzes);
  const newHighestScore = Math.max(profile.highestScore || 0, session.score);
  const progression = applyProgression(profile, session.correctAnswers, session.completedAt || new Date());

  await User.findByIdAndUpdate(userId, {
    'profile.totalQuizzes': newTotalQuizzes,
    'profile.averageScore': newAverageScore,
    'profile.highestScore': newHighestScore,
    'profile.xp': progression.xp,
    'profile.level': progression.level,
    'profile.currentStreak': progression.currentStreak,
    'profile.longestStreak': progression.longestStreak,
    'profile.lastQuizDate': progression.lastQuizDate
  });

  session.status = 'completed';
  session.completedAt = new Date();
  session.attemptId = scoreRecord._id;
  session.currentQuestionId = null;
  session.currentQuestionStartedAt = null;
  await session.save();

  emitLeaderboardUpdated({ attemptId: scoreRecord._id });

  return scoreRecord;
};

const nextDifficulty = (current, isCorrect) => {
  const idx = DIFF_ORDER.indexOf(current);
  const safeIdx = idx === -1 ? 1 : idx;
  const delta = isCorrect ? 1 : -1;
  return DIFF_ORDER[clamp(safeIdx + delta, 0, DIFF_ORDER.length - 1)];
};

const computeRemaining = (session) => {
  if (!session.currentQuestionStartedAt) return session.currentQuestionTimeLimit || 30;
  const elapsedSec = Math.floor((Date.now() - new Date(session.currentQuestionStartedAt).getTime()) / 1000);
  const limit = session.currentQuestionTimeLimit || 30;
  return Math.max(0, limit - elapsedSec);
};

const pickQuestion = async ({ category, difficulty, excludeIds }) => {
  const baseFilter = { isActive: true };
  if (category && category !== 'all') baseFilter.category = category;

  const tries = [difficulty];
  if (difficulty === 'easy') tries.push('medium', 'hard');
  else if (difficulty === 'medium') tries.push('hard', 'easy');
  else if (difficulty === 'hard') tries.push('medium', 'easy');

  for (const diff of tries) {
    const filter = { ...baseFilter, difficulty: diff, _id: { $nin: excludeIds } };
    const q = await Question.aggregate([
      { $match: filter },
      { $sample: { size: 1 } },
      {
        $project: {
          correctAnswer: 0,
          explanation: 0,
          timesAnswered: 0,
          timesCorrect: 0,
          createdBy: 0,
          isActive: 0
        }
      }
    ]);

    if (q && q.length > 0) return { question: q[0], effectiveDifficulty: diff };
  }

  // Last resort: any difficulty.
  const anyFilter = { ...baseFilter, _id: { $nin: excludeIds } };
  const qAny = await Question.aggregate([
    { $match: anyFilter },
    { $sample: { size: 1 } },
    {
      $project: {
        correctAnswer: 0,
        explanation: 0,
        timesAnswered: 0,
        timesCorrect: 0,
        createdBy: 0,
        isActive: 0
      }
    }
  ]);
  if (qAny && qAny.length > 0) return { question: qAny[0], effectiveDifficulty: qAny[0].difficulty };
  return null;
};

const startSession = async (req, res, next) => {
  try {
    const { category, difficulty, count } = req.body || {};
    const sessionCategory = category || 'General Knowledge';
    const baseFilter = { isActive: true };
    if (sessionCategory !== 'all') baseFilter.category = sessionCategory;
    const availableCount = await Question.countDocuments(baseFilter);

    if (availableCount === 0) {
      return res.status(404).json({
        success: false,
        message: 'No questions available for this quiz'
      });
    }

    const requestedCount = parseInt(count, 10);
    const clampedRequest = Number.isFinite(requestedCount)
      ? clamp(requestedCount, 1, 50)
      : null;
    const targetCount = clampedRequest ? Math.min(clampedRequest, availableCount) : availableCount;

    // Only allow one active session per user.
    await QuizSession.updateMany(
      { user: req.user._id, status: 'active' },
      { $set: { status: 'abandoned' }, $push: { events: { type: 'auto_abandoned' } } }
    );

    const initialDifficulty = DIFF_ORDER.includes(difficulty) ? difficulty : 'medium';

    const session = await QuizSession.create({
      user: req.user._id,
      status: 'active',
      category: sessionCategory,
      targetCount,
      currentIndex: 0,
      currentDifficulty: initialDifficulty,
      score: 0,
      maxScore: 0,
      correctAnswers: 0,
      currentQuestionId: null,
      currentQuestionStartedAt: null,
      currentQuestionTimeLimit: 30,
      expiresAt: new Date(Date.now() + 60 * 60 * 1000) // 1h TTL
    });

    const picked = await pickQuestion({
      category: session.category,
      difficulty: session.currentDifficulty,
      excludeIds: []
    });

    if (!picked) {
      await session.updateOne({ status: 'abandoned' });
      return res.status(404).json({
        success: false,
        message: 'No questions available for this quiz'
      });
    }

    await QuizSession.findByIdAndUpdate(session._id, {
      $set: {
        currentQuestionId: picked.question._id,
        currentQuestionStartedAt: new Date(),
        currentQuestionTimeLimit: picked.question.timeLimit || 30,
        currentDifficulty: picked.effectiveDifficulty
      }
    });

    res.status(201).json({
      success: true,
      data: {
        sessionId: session._id,
        progress: { index: 0, total: targetCount },
        difficulty: picked.effectiveDifficulty,
        timeLeft: picked.question.timeLimit || 30,
        question: picked.question
      }
    });
  } catch (error) {
    next(error);
  }
};

const getActiveSession = async (req, res, next) => {
  try {
    const session = await QuizSession.findOne({ user: req.user._id, status: 'active' }).sort({ createdAt: -1 }).lean();
    if (!session) {
      return res.json({ success: true, data: null });
    }

    const timeLeft = computeRemaining(session);
    const q = await Question.findById(session.currentQuestionId).select('-correctAnswer -explanation').lean();

    res.json({
      success: true,
      data: {
        sessionId: session._id,
        progress: { index: session.currentIndex, total: session.targetCount },
        difficulty: session.currentDifficulty,
        timeLeft,
        question: q
      }
    });
  } catch (error) {
    next(error);
  }
};

const getSession = async (req, res, next) => {
  try {
    const session = await QuizSession.findById(req.params.id).lean();
    if (!session) {
      return res.status(404).json({ success: false, message: 'Session not found' });
    }

    if (session.user.toString() !== req.user._id.toString() && req.user.role !== 'admin') {
      return res.status(403).json({ success: false, message: 'Not authorized' });
    }

    if (session.status !== 'active') {
      return res.json({ success: true, data: { status: session.status, attemptId: session.attemptId } });
    }

    const timeLeft = computeRemaining(session);
    const q = await Question.findById(session.currentQuestionId).select('-correctAnswer -explanation').lean();

    res.json({
      success: true,
      data: {
        sessionId: session._id,
        progress: { index: session.currentIndex, total: session.targetCount },
        difficulty: session.currentDifficulty,
        timeLeft,
        question: q
      }
    });
  } catch (error) {
    next(error);
  }
};

const recordEvent = async (req, res, next) => {
  try {
    const { type } = req.body || {};
    if (!type) {
      return res.status(400).json({ success: false, message: 'Event type required' });
    }

    const session = await QuizSession.findById(req.params.id);
    if (!session) {
      return res.status(404).json({ success: false, message: 'Session not found' });
    }
    if (session.user.toString() !== req.user._id.toString()) {
      return res.status(403).json({ success: false, message: 'Not authorized' });
    }
    if (session.status !== 'active') {
      return res.json({ success: true });
    }

    const inc = {};
    if (type === 'tab_hidden') inc['violations.tabSwitches'] = 1;
    if (type === 'window_blur') inc['violations.blurs'] = 1;
    if (type === 'navigation_attempt' || type === 'resume') inc['violations.navigations'] = 1;

    await QuizSession.updateOne(
      { _id: session._id },
      {
        $push: { events: { type } },
        ...(Object.keys(inc).length > 0 ? { $inc: inc } : {})
      }
    );

    res.json({ success: true });
  } catch (error) {
    next(error);
  }
};

const answerCurrent = async (req, res, next) => {
  try {
    const { userAnswer } = req.body || {};
    const session = await QuizSession.findById(req.params.id);

    if (!session) {
      return res.status(404).json({ success: false, message: 'Session not found' });
    }
    if (session.user.toString() !== req.user._id.toString()) {
      return res.status(403).json({ success: false, message: 'Not authorized' });
    }
    if (session.status !== 'active') {
      return res.status(409).json({ success: false, message: 'Session is not active' });
    }

    const questionId = session.currentQuestionId;
    const question = await Question.findById(questionId).lean();
    if (!question) {
      return res.status(400).json({ success: false, message: 'Invalid question' });
    }

    const elapsedSec = Math.floor((Date.now() - new Date(session.currentQuestionStartedAt).getTime()) / 1000);
    const timeLimit = session.currentQuestionTimeLimit || question.timeLimit || 30;
    const cappedTimeSpent = clamp(elapsedSec, 0, timeLimit);

    const skipped = userAnswer == null || normalize(userAnswer) === '' || cappedTimeSpent >= timeLimit;
    const isCorrect = !skipped && normalize(userAnswer) === normalize(question.correctAnswer);
    const points = question.points || 10;
    const pointsEarned = isCorrect ? points : 0;

    const newMaxScore = session.maxScore + points;
    const newScore = session.score + pointsEarned;
    const newCorrect = session.correctAnswers + (isCorrect ? 1 : 0);

    const updatedDifficulty = nextDifficulty(session.currentDifficulty, isCorrect);

    const askedEntry = {
      questionId: question._id,
      difficulty: session.currentDifficulty,
      userAnswer: skipped ? null : userAnswer,
      isCorrect,
      timeSpent: cappedTimeSpent,
      points,
      pointsEarned,
      answeredAt: new Date()
    };

    session.asked.push(askedEntry);
    session.currentIndex += 1;
    session.score = newScore;
    session.maxScore = newMaxScore;
    session.correctAnswers = newCorrect;
    session.currentDifficulty = updatedDifficulty;

    // Update question analytics.
    await Question.updateOne({ _id: question._id }, { $inc: { timesAnswered: 1, ...(isCorrect ? { timesCorrect: 1 } : {}) } });

    const excludeIds = session.asked.map(a => a.questionId);

    const isFinished = session.currentIndex >= session.targetCount;
    if (isFinished) {
      const scoreRecord = await finalizeSession(session, req.user._id);

      return res.json({
        success: true,
        data: {
          finished: true,
          attemptId: scoreRecord._id,
          score: buildScorePayload(scoreRecord)
        }
      });
    }

    // Pick next question.
    const picked = await pickQuestion({
      category: session.category,
      difficulty: session.currentDifficulty,
      excludeIds
    });

    if (!picked) {
      // Finish early if we ran out of questions.
      session.status = 'abandoned';
      session.completedAt = new Date();
      await session.save();
      return res.status(409).json({
        success: false,
        message: 'No more questions available'
      });
    }

    session.currentQuestionId = picked.question._id;
    session.currentQuestionStartedAt = new Date();
    session.currentQuestionTimeLimit = picked.question.timeLimit || 30;
    session.currentDifficulty = picked.effectiveDifficulty;
    await session.save();

    res.json({
      success: true,
      data: {
        finished: false,
        progress: { index: session.currentIndex, total: session.targetCount },
        difficulty: session.currentDifficulty,
        timeLeft: session.currentQuestionTimeLimit,
        // Question payload without answers.
        question: picked.question,
        last: {
          skipped,
          isCorrect,
          questionId: question._id,
          userAnswer: skipped ? null : userAnswer,
          correctAnswer: question.correctAnswer
        }
      }
    });
  } catch (error) {
    next(error);
  }
};

const finishSession = async (req, res, next) => {
  try {
    const { reason } = req.body || {};
    const session = await QuizSession.findById(req.params.id);
    if (!session) return res.status(404).json({ success: false, message: 'Session not found' });
    if (session.user.toString() !== req.user._id.toString()) {
      return res.status(403).json({ success: false, message: 'Not authorized' });
    }
    if (session.status !== 'active') {
      return res.json({ success: true, data: { status: session.status, attemptId: session.attemptId } });
    }

    session.events.push({ type: reason ? `forced_finish:${reason}` : 'forced_finish' });
    session.targetCount = Math.max(session.currentIndex, 1);

    const scoreRecord = await finalizeSession(session, req.user._id);

    return res.json({
      success: true,
      data: {
        finished: true,
        attemptId: scoreRecord._id,
        score: buildScorePayload(scoreRecord)
      }
    });
  } catch (error) {
    next(error);
  }
};

const abandonSession = async (req, res, next) => {
  try {
    const session = await QuizSession.findById(req.params.id);
    if (!session) return res.status(404).json({ success: false, message: 'Session not found' });
    if (session.user.toString() !== req.user._id.toString()) {
      return res.status(403).json({ success: false, message: 'Not authorized' });
    }
    if (session.status !== 'active') return res.json({ success: true });

    session.status = 'abandoned';
    session.completedAt = new Date();
    session.events.push({ type: 'user_abandoned' });
    await session.save();

    res.json({ success: true });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  startSession,
  getActiveSession,
  getSession,
  answerCurrent,
  recordEvent,
  abandonSession,
  finishSession
};
