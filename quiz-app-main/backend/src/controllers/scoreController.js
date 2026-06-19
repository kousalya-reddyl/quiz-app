const mongoose = require('mongoose');
const { Score, Question, User } = require('../models');
const { emitLeaderboardUpdated } = require('../realtime/socket');
const { evaluateSuspicion } = require('../utils/cheatDetection');
const { applyProgression, nextLevelXp } = require('../utils/learning');

const submitScore = async (req, res, next) => {
  try {
    const { category, difficulty, answers } = req.body;

    if (!Array.isArray(answers) || answers.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'Answers array is required'
      });
    }

    const normalizedAnswers = answers
      .filter(a => a && a.questionId)
      .map(a => ({
        questionId: a.questionId,
        userAnswer: typeof a.userAnswer === 'string' ? a.userAnswer : null,
        timeSpent: Number.isFinite(a.timeSpent) ? a.timeSpent : 0
      }));

    if (normalizedAnswers.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'No valid answers found'
      });
    }

    const questionIds = normalizedAnswers.map(a => a.questionId);
    const uniqueIds = [...new Set(questionIds.map(id => id.toString()))];

    if (uniqueIds.length !== questionIds.length) {
      return res.status(400).json({
        success: false,
        message: 'Duplicate questionId values are not allowed'
      });
    }

    const questions = await Question.find({ _id: { $in: uniqueIds }, isActive: true })
      .select('question options correctAnswer explanation points')
      .lean();

    if (questions.length !== uniqueIds.length) {
      return res.status(400).json({
        success: false,
        message: 'One or more questionId values are invalid'
      });
    }

    const questionMap = new Map(questions.map(q => [q._id.toString(), q]));

    let score = 0;
    let maxScore = 0;
    let correctAnswers = 0;

    const questionResults = normalizedAnswers.map(a => {
      const q = questionMap.get(a.questionId.toString());
      const points = q?.points || 10;
      maxScore += points;

      const userAnswerNorm = typeof a.userAnswer === 'string' ? a.userAnswer.trim().toLowerCase() : null;
      const correctNorm = q?.correctAnswer ? q.correctAnswer.trim().toLowerCase() : null;
      const isCorrect = !!(userAnswerNorm && correctNorm && userAnswerNorm === correctNorm);

      const pointsEarned = isCorrect ? points : 0;
      score += pointsEarned;
      if (isCorrect) correctAnswers += 1;

      return {
        questionId: a.questionId,
        topic: q?.topic || 'General',
        questionText: q?.question,
        options: q?.options,
        userAnswer: a.userAnswer,
        correctAnswer: q?.correctAnswer,
        explanation: q?.explanation,
        isCorrect,
        timeSpent: Math.max(0, Math.floor(a.timeSpent || 0)),
        points,
        pointsEarned
      };
    });

    const totalQuestions = questionResults.length;
    const percentage = totalQuestions > 0 ? Math.round((correctAnswers / totalQuestions) * 100) : 0;
    const timeTaken = questionResults.reduce((sum, q) => sum + (q.timeSpent || 0), 0);

    const suspicion = evaluateSuspicion({
      violations: null,
      percentage,
      totalQuestions,
      timeTaken
    });

    const scoreRecord = await Score.create({
      user: req.user._id,
      score,
      maxScore,
      totalQuestions,
      correctAnswers,
      category: category || 'General Knowledge',
      difficulty: difficulty === 'all' ? 'mixed' : (difficulty || 'mixed'),
      timeTaken,
      questions: questionResults,
      percentage,
      suspicious: suspicion.suspicious,
      suspiciousReasons: suspicion.reasons
    });

    await Question.updateMany(
      { _id: { $in: questionIds } },
      { $inc: { timesAnswered: 1 } }
    );

    const correctQuestionIds = questionResults.filter(q => q.isCorrect).map(q => q.questionId);
    if (correctQuestionIds.length > 0) {
      await Question.updateMany(
        { _id: { $in: correctQuestionIds } },
        { $inc: { timesCorrect: 1 } }
      );
    }

    const user = await User.findById(req.user._id);
    const profile = user?.profile || { totalQuizzes: 0, averageScore: 0, highestScore: 0 };

    const newTotalQuizzes = profile.totalQuizzes + 1;
    const newAverageScore = Math.round(
      ((profile.averageScore * profile.totalQuizzes) + score) / newTotalQuizzes
    );
    const newHighestScore = Math.max(profile.highestScore, score);

    const progression = applyProgression(profile, correctAnswers, scoreRecord.completedAt);

    await User.findByIdAndUpdate(req.user._id, {
      'profile.totalQuizzes': newTotalQuizzes,
      'profile.averageScore': newAverageScore,
      'profile.highestScore': newHighestScore,
      'profile.xp': progression.xp,
      'profile.level': progression.level,
      'profile.currentStreak': progression.currentStreak,
      'profile.longestStreak': progression.longestStreak,
      'profile.lastQuizDate': progression.lastQuizDate
    });

    emitLeaderboardUpdated({ attemptId: scoreRecord._id });

    res.status(201).json({
      success: true,
      message: 'Score saved successfully',
      data: {
        score: {
          _id: scoreRecord._id,
          score: scoreRecord.score,
          maxScore: scoreRecord.maxScore,
          totalQuestions: scoreRecord.totalQuestions,
          correctAnswers: scoreRecord.correctAnswers,
          percentage: scoreRecord.percentage,
          category: scoreRecord.category,
          difficulty: scoreRecord.difficulty,
          completedAt: scoreRecord.completedAt
        },
        stats: {
          totalQuizzes: newTotalQuizzes,
          averageScore: newAverageScore,
          highestScore: newHighestScore,
          xp: progression.xp,
          level: progression.level,
          xpNextLevel: nextLevelXp(progression.level),
          currentStreak: progression.currentStreak,
          longestStreak: progression.longestStreak
        }
      }
    });
  } catch (error) {
    next(error);
  }
};

const getLeaderboard = async (req, res, next) => {
  try {
    const { page = 1, limit = 10, category, difficulty, timeframe } = req.query;
    
    const leaderboard = await Score.getLeaderboard({
      page: parseInt(page),
      limit: parseInt(limit),
      category,
      difficulty,
      timeframe
    });

    // Count unique users matching the same filters for correct pagination.
    const matchStage = {};
    if (category && category !== 'all') matchStage.category = category;
    if (difficulty && difficulty !== 'all') matchStage.difficulty = difficulty;
    if (timeframe && timeframe !== 'all') {
      const startDate = new Date();
      if (timeframe === 'day') startDate.setDate(startDate.getDate() - 1);
      else if (timeframe === 'week') startDate.setDate(startDate.getDate() - 7);
      else if (timeframe === 'month') startDate.setMonth(startDate.getMonth() - 1);
      matchStage.completedAt = { $gte: startDate };
    }

    const totalAgg = await Score.aggregate([
      { $match: matchStage },
      { $group: { _id: '$user' } },
      { $count: 'total' }
    ]);
    const total = totalAgg[0]?.total || 0;
    
    res.json({
      success: true,
      data: leaderboard,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        pages: Math.ceil(total / parseInt(limit))
      }
    });
  } catch (error) {
    next(error);
  }
};

const getUserHistory = async (req, res, next) => {
  try {
    const { page = 1, limit = 10 } = req.query;
    
    const scores = await Score.find({ user: req.user._id })
      .sort({ completedAt: -1 })
      .select('-questions')
      .skip((parseInt(page) - 1) * parseInt(limit))
      .limit(parseInt(limit));
    
    const total = await Score.countDocuments({ user: req.user._id });
    
    res.json({
      success: true,
      data: scores,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        pages: Math.ceil(total / limit)
      }
    });
  } catch (error) {
    next(error);
  }
};

const getUserStats = async (req, res, next) => {
  try {
    let userId = req.user._id.toString();
    if (req.params.userId) {
      if (req.user.role !== 'admin') {
        return res.status(403).json({
          success: false,
          message: 'Access denied. Admin only.'
        });
      }
      userId = req.params.userId;
    }
    
    const stats = await Score.getUserStats(userId);
    
    const recentQuizzes = await Score.find({ user: userId })
      .sort({ completedAt: -1 })
      .limit(5);
    
    res.json({
      success: true,
      data: {
        ...stats,
        recentQuizzes
      }
    });
  } catch (error) {
    next(error);
  }
};

const getMyBestScores = async (req, res, next) => {
  try {
    const bestScores = await Score.aggregate([
      { $match: { user: req.user._id } },
      { $sort: { score: -1 } },
      { $limit: 5 },
      {
        $project: {
          score: 1,
          maxScore: 1,
          totalQuestions: 1,
          correctAnswers: 1,
          percentage: 1,
          category: 1,
          difficulty: 1,
          completedAt: 1
        }
      }
    ]);
    
    res.json({
      success: true,
      data: bestScores
    });
  } catch (error) {
    next(error);
  }
};

const getScoreAttempt = async (req, res, next) => {
  try {
    const attempt = await Score.findById(req.params.id).lean();

    if (!attempt) {
      return res.status(404).json({
        success: false,
        message: 'Score attempt not found'
      });
    }

    const isOwner = attempt.user.toString() === req.user._id.toString();
    const isAdmin = req.user.role === 'admin';

    if (!isOwner && !isAdmin) {
      return res.status(403).json({
        success: false,
        message: 'Not authorized to view this attempt'
      });
    }

    res.json({
      success: true,
      data: attempt
    });
  } catch (error) {
    next(error);
  }
};

const getLearningDashboard = async (req, res, next) => {
  try {
    const userId = req.user._id;
    const user = await User.findById(userId).select('profile').lean();
    const profile = user?.profile || {};

    const totalsAgg = await Score.aggregate([
      { $match: { user: new mongoose.Types.ObjectId(userId) } },
      {
        $group: {
          _id: null,
          totalQuizzes: { $sum: 1 },
          totalCorrect: { $sum: '$correctAnswers' },
          totalQuestions: { $sum: '$totalQuestions' }
        }
      }
    ]);

    const totals = totalsAgg[0] || { totalQuizzes: 0, totalCorrect: 0, totalQuestions: 0 };
    const accuracy = totals.totalQuestions > 0
      ? Math.round((totals.totalCorrect / totals.totalQuestions) * 100)
      : 0;

    const scoreTrendRaw = await Score.find({ user: userId })
      .sort({ completedAt: -1 })
      .limit(20)
      .select('score percentage completedAt')
      .lean();

    const scoreTrend = scoreTrendRaw
      .slice()
      .reverse()
      .map((s) => ({
        date: new Date(s.completedAt).toISOString().slice(0, 10),
        score: s.score,
        percentage: s.percentage
      }));

    const topicAgg = await Score.aggregate([
      { $match: { user: new mongoose.Types.ObjectId(userId) } },
      { $unwind: '$questions' },
      {
        $project: {
          topic: { $ifNull: ['$questions.topic', 'General'] },
          isCorrect: '$questions.isCorrect'
        }
      },
      {
        $group: {
          _id: '$topic',
          total: { $sum: 1 },
          correct: { $sum: { $cond: ['$isCorrect', 1, 0] } }
        }
      },
      {
        $addFields: {
          accuracy: {
            $cond: [
              { $gt: ['$total', 0] },
              { $round: [{ $multiply: [{ $divide: ['$correct', '$total'] }, 100] }, 1] },
              0
            ]
          }
        }
      },
      { $sort: { accuracy: 1, total: -1 } }
    ]);

    const topicPerformance = topicAgg.map((t) => ({
      topic: t._id,
      total: t.total,
      correct: t.correct,
      accuracy: t.accuracy
    }));

    const weakTopics = topicPerformance
      .filter(t => t.total >= 3)
      .sort((a, b) => a.accuracy - b.accuracy)
      .slice(0, 5);

    const fallbackWeak = weakTopics.length > 0
      ? weakTopics
      : topicPerformance.slice(0, 3);

    const recommendations = fallbackWeak.map((t) => ({
      topic: t.topic,
      reason: t.total ? `Accuracy ${t.accuracy}% over ${t.total} questions` : 'Not enough data yet'
    }));

    const mistakeAgg = await Score.aggregate([
      { $match: { user: new mongoose.Types.ObjectId(userId) } },
      { $unwind: '$questions' },
      { $match: { 'questions.isCorrect': false } },
      {
        $group: {
          _id: '$questions.topic',
          mistakes: {
            $push: {
              questionText: '$questions.questionText',
              userAnswer: '$questions.userAnswer',
              correctAnswer: '$questions.correctAnswer',
              questionId: '$questions.questionId',
              scoreId: '$_id',
              completedAt: '$completedAt'
            }
          },
          mistakeCount: { $sum: 1 }
        }
      },
      { $sort: { mistakeCount: -1 } }
    ]);

    const mistakeAnalysis = mistakeAgg.map((m) => ({
      topic: m._id || 'General',
      mistakeCount: m.mistakeCount,
      questions: m.mistakes.slice(0, 5).map((q) => ({
        questionText: q.questionText,
        userAnswer: q.userAnswer,
        correctAnswer: q.correctAnswer,
        questionId: q.questionId,
        scoreId: q.scoreId,
        completedAt: q.completedAt
      }))
    }));

    res.json({
      success: true,
      data: {
        overview: {
          totalQuizzes: totals.totalQuizzes,
          accuracy,
          currentStreak: profile.currentStreak || 0,
          longestStreak: profile.longestStreak || 0,
          xp: profile.xp || 0,
          level: profile.level || 1,
          xpNextLevel: nextLevelXp(profile.level || 1)
        },
        scoreTrend,
        topicPerformance,
        weakTopics: fallbackWeak,
        recommendations,
        mistakeAnalysis
      }
    });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  submitScore,
  getLeaderboard,
  getUserHistory,
  getUserStats,
  getMyBestScores,
  getScoreAttempt,
  getLearningDashboard
};
