import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import API from '../services/api';
import { useAuth } from '../context/AuthContext';
import { notify } from '../components/Toast';
import './Quiz.css';

const CATEGORIES = ['Science', 'History', 'Geography', 'Sports', 'Entertainment', 'Technology', 'General Knowledge'];
const DIFFICULTIES = ['easy', 'medium', 'hard'];

const ACTIVE_SESSION_KEY = 'quizActiveSessionId';
const SESSION_STATE_KEY = 'quizSessionState';

const normalize = (v) => (typeof v === 'string' ? v.trim().toLowerCase() : '');

const Quiz = () => {
  const { refreshUser } = useAuth();

  const [category, setCategory] = useState('all');
  const [difficulty, setDifficulty] = useState('medium');

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const [sessionId, setSessionId] = useState(null);
  const [question, setQuestion] = useState(null);
  const [progress, setProgress] = useState({ index: 0, total: 0 });
  const [currentDifficulty, setCurrentDifficulty] = useState('medium');

  const [timeLeft, setTimeLeft] = useState(0);
  const [selectedAnswer, setSelectedAnswer] = useState(null);

  const [showResult, setShowResult] = useState(false);
  const [result, setResult] = useState(null);
  const [animatedPercentage, setAnimatedPercentage] = useState(0);

  const [attempt, setAttempt] = useState(null);
  const [reviewOpen, setReviewOpen] = useState(false);
  const [reviewLoading, setReviewLoading] = useState(false);
  const [reviewError, setReviewError] = useState(null);

  const [violations, setViolations] = useState({ tabSwitches: 0, blurs: 0 });
  const [questionHistory, setQuestionHistory] = useState([]);
  const [viewIndex, setViewIndex] = useState(null);
  const [answerFeedback, setAnswerFeedback] = useState(null);
  const [canAdvance, setCanAdvance] = useState(false);

  const answeredLockRef = useRef(false);
  const finishingRef = useRef(false);
  const timeUpLockRef = useRef(false);
  const forcedFinishRef = useRef(false);
  const advanceTimerRef = useRef(null);
  const pendingNextRef = useRef(null);

  const inQuiz = !!sessionId && !showResult;

  const correctAnswers = result?.correctAnswers ?? 0;
  const percentage = result?.percentage ?? 0;

  const resetRunState = () => {
    setSessionId(null);
    setQuestion(null);
    setProgress({ index: 0, total: 0 });
    setCurrentDifficulty('medium');
    setTimeLeft(0);
    setSelectedAnswer(null);
    setShowResult(false);
    setResult(null);
    setAnimatedPercentage(0);
    setAttempt(null);
    setReviewOpen(false);
    setReviewError(null);
    setViolations({ tabSwitches: 0, blurs: 0 });
    setQuestionHistory([]);
    setViewIndex(null);
    setAnswerFeedback(null);
    setCanAdvance(false);
    answeredLockRef.current = false;
    finishingRef.current = false;
    timeUpLockRef.current = false;
    forcedFinishRef.current = false;
    pendingNextRef.current = null;
    if (advanceTimerRef.current) {
      clearTimeout(advanceTimerRef.current);
      advanceTimerRef.current = null;
    }
  };

  const sessionStateKey = useCallback((id) => `${SESSION_STATE_KEY}:${id}`, []);

  const hydrateFromSessionPayload = useCallback((payload) => {
    setSessionId(payload.sessionId);
    setProgress(payload.progress);
    setCurrentDifficulty(payload.difficulty || 'medium');
    setTimeLeft(payload.timeLeft || 0);
    setQuestion(payload.question);
    setSelectedAnswer(null);
    setViewIndex(null);
    setAnswerFeedback(null);
    setCanAdvance(false);
    answeredLockRef.current = false;
    timeUpLockRef.current = false;

    localStorage.setItem(ACTIVE_SESSION_KEY, payload.sessionId);
  }, []);

  const resumeSession = useCallback(async (id) => {
    const res = await API.get(`/quiz/sessions/${id}`);
    if (!res.data?.data) return;

    if (res.data.data.status && res.data.data.status !== 'active') {
      localStorage.removeItem(ACTIVE_SESSION_KEY);
      resetRunState();
      return;
    }

    hydrateFromSessionPayload(res.data.data);

    // Mark this as a resume (refresh/navigation) for anti-cheat tracking.
    try {
      await API.post(`/quiz/sessions/${id}/events`, { type: 'resume' });
    } catch {
      // ignore
    }
  }, [hydrateFromSessionPayload]);

  // Resume active session on mount.
  useEffect(() => {
    const run = async () => {
      const stored = localStorage.getItem(ACTIVE_SESSION_KEY);
      if (!stored) return;
      try {
        setLoading(true);
        await resumeSession(stored);
      } catch {
        localStorage.removeItem(ACTIVE_SESSION_KEY);
      } finally {
        setLoading(false);
      }
    };

    run();
  }, [resumeSession]);

  useEffect(() => {
    if (!sessionId) return;
    if (questionHistory.length > 0) return;
    const raw = localStorage.getItem(sessionStateKey(sessionId));
    if (!raw) return;
    try {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed.history)) {
        setQuestionHistory(parsed.history);
      }
    } catch {
      // ignore corrupted cache
    }
  }, [sessionId, questionHistory.length, sessionStateKey]);

  useEffect(() => {
    if (!sessionId) return;
    const payload = {
      history: questionHistory
    };
    localStorage.setItem(sessionStateKey(sessionId), JSON.stringify(payload));
  }, [sessionId, questionHistory, sessionStateKey]);


  // Server-authoritative timer (client renders countdown; server caps).
  useEffect(() => {
    if (!inQuiz) return;
    if (timeLeft <= 0) return;

    const t = setInterval(() => {
      setTimeLeft((prev) => Math.max(0, prev - 1));
    }, 1000);

    return () => clearInterval(t);
  }, [inQuiz, timeLeft]);

  // Auto-skip when timer hits 0.
  useEffect(() => {
    if (!inQuiz) return;
    if (!question) return;
    if (timeLeft !== 0) return;
    if (timeUpLockRef.current) return;
    timeUpLockRef.current = true;

    const skip = async () => {
      try {
        await submitAnswer(null, { isAuto: true });
      } catch {
        // handled by submitAnswer
      }
    };

    skip();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [inQuiz, timeLeft, question]);

  // Anti-cheat: tab switch + blur.
  useEffect(() => {
    if (!inQuiz || !sessionId) return;

    const sendEvent = async (type) => {
      try {
        await API.post(`/quiz/sessions/${sessionId}/events`, { type });
      } catch {
        // ignore
      }
    };

    const onVisibility = () => {
      if (document.hidden) {
        setViolations((v) => ({ ...v, tabSwitches: v.tabSwitches + 1 }));
        sendEvent('tab_hidden');
      }
    };

    const onBlur = () => {
      setViolations((v) => ({ ...v, blurs: v.blurs + 1 }));
      sendEvent('window_blur');
    };

    const onBeforeUnload = (e) => {
      // Prevent silent refresh/navigation (state is resumable, but timer is server-authoritative).
      e.preventDefault();
      e.returnValue = '';
      return '';
    };

    document.addEventListener('visibilitychange', onVisibility);
    window.addEventListener('blur', onBlur);
    window.addEventListener('beforeunload', onBeforeUnload);

    return () => {
      document.removeEventListener('visibilitychange', onVisibility);
      window.removeEventListener('blur', onBlur);
      window.removeEventListener('beforeunload', onBeforeUnload);
    };
  }, [inQuiz, sessionId]);

  // Animate percentage on result screen.
  useEffect(() => {
    if (!showResult) {
      setAnimatedPercentage(0);
      return;
    }

    if (!result) {
      setAnimatedPercentage(0);
      return;
    }

    const p = Number.isFinite(result.percentage) ? Math.round(result.percentage) : 0;
    let start = 0;
    const duration = 900;
    const increment = p / (duration / 16);

    const timer = setInterval(() => {
      start += increment;
      if (start >= p) {
        setAnimatedPercentage(p);
        clearInterval(timer);
      } else {
        setAnimatedPercentage(Math.round(start));
      }
    }, 16);

    return () => clearInterval(timer);
  }, [showResult, result]);

  const clearAdvanceTimer = useCallback(() => {
    if (advanceTimerRef.current) {
      clearTimeout(advanceTimerRef.current);
      advanceTimerRef.current = null;
    }
  }, []);

  const advanceToNext = useCallback(() => {
    const payload = pendingNextRef.current;
    if (!payload) return;
    clearAdvanceTimer();
    pendingNextRef.current = null;
    setCanAdvance(false);
    setAnswerFeedback(null);
    setViewIndex(null);
    setProgress(payload.progress);
    setCurrentDifficulty(payload.difficulty);
    setTimeLeft(payload.timeLeft);
    setQuestion(payload.question);
    setSelectedAnswer(null);
    answeredLockRef.current = false;
    timeUpLockRef.current = false;
  }, [clearAdvanceTimer]);

  const queueAdvance = useCallback((payload) => {
    pendingNextRef.current = payload;
    setCanAdvance(true);
    clearAdvanceTimer();
    advanceTimerRef.current = setTimeout(() => {
      advanceToNext();
    }, 900);
  }, [advanceToNext, clearAdvanceTimer]);

  const fetchAttempt = useCallback(async (attemptId) => {
    setReviewLoading(true);
    setReviewError(null);
    try {
      const attemptRes = await API.get(`/scores/${attemptId}`);
      setAttempt(attemptRes.data.data);
    } catch (e) {
      setReviewError(e.response?.data?.message || 'Failed to load review');
    } finally {
      setReviewLoading(false);
    }
  }, []);

  const handleFinish = useCallback(async (data) => {
    localStorage.removeItem(ACTIVE_SESSION_KEY);
    if (sessionId) {
      localStorage.removeItem(sessionStateKey(sessionId));
    }
    clearAdvanceTimer();
    pendingNextRef.current = null;
    setCanAdvance(false);
    setAnswerFeedback(null);
    setViewIndex(null);
    setShowResult(true);
    setResult(data.score);
    setTimeLeft(0);

    if (data.attemptId) {
      await fetchAttempt(data.attemptId);
    }

    await refreshUser();
  }, [clearAdvanceTimer, fetchAttempt, refreshUser, sessionId, sessionStateKey]);

  const startQuiz = async () => {
    setLoading(true);
    setError(null);
    resetRunState();

    try {
      const res = await API.post('/quiz/sessions', {
        category,
        difficulty
      });

      hydrateFromSessionPayload(res.data.data);
    } catch (e) {
      setError(e.response?.data?.message || 'Failed to start quiz');
    } finally {
      setLoading(false);
    }
  };

  const submitAnswer = async (answer, opts = {}) => {
    if (!sessionId || !question) return;
    if (answeredLockRef.current) return;
    answeredLockRef.current = true;

    const isAuto = !!opts.isAuto;
    const answeredIndex = progress.index;
    const snapshot = question;
    if (!isAuto) setSelectedAnswer(answer);

    try {
      const res = await API.post(`/quiz/sessions/${sessionId}/answer`, {
        userAnswer: answer
      });

      const data = res.data.data;
      if (data.finished) {
        await handleFinish(data);
        return;
      }

      const last = data.last || {};
      const historyEntry = {
        index: answeredIndex,
        question: snapshot,
        questionId: last.questionId || snapshot._id,
        userAnswer: last.userAnswer ?? answer ?? null,
        correctAnswer: last.correctAnswer ?? null,
        isCorrect: !!last.isCorrect,
        skipped: !!last.skipped,
        autoSkipped: isAuto
      };

      setQuestionHistory((prev) => {
        const next = Array.isArray(prev) ? [...prev] : [];
        next[answeredIndex] = historyEntry;
        return next;
      });

      setAnswerFeedback(historyEntry);
      setTimeLeft(data.timeLeft);
      queueAdvance({
        progress: data.progress,
        difficulty: data.difficulty,
        timeLeft: data.timeLeft,
        question: data.question
      });
    } catch (e) {
      notify.error(e.response?.data?.message || 'Failed to submit answer');
      answeredLockRef.current = false;
    }
  };

  const abandon = async () => {
    if (!sessionId) return;
    if (finishingRef.current) return;
    finishingRef.current = true;

    try {
      await API.post(`/quiz/sessions/${sessionId}/abandon`);
    } catch {
      // ignore
    } finally {
      localStorage.removeItem(ACTIVE_SESSION_KEY);
      localStorage.removeItem(sessionStateKey(sessionId));
      resetRunState();
      finishingRef.current = false;
    }
  };

  const setupDisabled = loading || inQuiz;

  const antiCheatWarning = useMemo(() => {
    if (violations.tabSwitches === 0 && violations.blurs === 0) return null;
    const parts = [];
    if (violations.tabSwitches > 0) {
      parts.push(`Tab switches: ${violations.tabSwitches}/3`);
    }
    if (violations.blurs > 0) {
      parts.push(`Focus lost: ${violations.blurs}`);
    }
    const headline = violations.tabSwitches >= 3
      ? 'Quiz submitted due to repeated tab switching.'
      : 'Stay on this tab to avoid auto-submission.';
    return { headline, detail: parts.join(' • ') };
  }, [violations]);

  const timerState = timeLeft <= 5 ? 'critical' : timeLeft <= 10 ? 'low' : 'normal';
  const isReviewing = viewIndex !== null && viewIndex < progress.index;
  const activeEntry = isReviewing ? questionHistory[viewIndex] : answerFeedback;
  const activeQuestion = activeEntry?.question || question;
  const activeIndex = isReviewing ? viewIndex : progress.index;
  const interactionLocked = isReviewing || !!answerFeedback || answeredLockRef.current;

  const forceFinish = useCallback(async (reason) => {
    if (!sessionId) return;
    if (finishingRef.current) return;
    finishingRef.current = true;
    try {
      const res = await API.post(`/quiz/sessions/${sessionId}/finish`, { reason });
      await handleFinish(res.data.data);
    } catch (e) {
      notify.error(e.response?.data?.message || 'Failed to submit quiz');
    } finally {
      finishingRef.current = false;
    }
  }, [handleFinish, sessionId]);

  useEffect(() => {
    if (!inQuiz) return;
    if (violations.tabSwitches < 3) return;
    if (forcedFinishRef.current) return;
    forcedFinishRef.current = true;
    forceFinish('tab_switch_limit');
  }, [forceFinish, inQuiz, violations.tabSwitches]);

  useEffect(() => {
    if (!inQuiz) return;

    const onKeyDown = (e) => {
      if (e.repeat) return;
      const tag = e.target?.tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return;

      const key = e.key.toLowerCase();
      if (key === 'enter') {
        if (isReviewing) {
          setViewIndex(null);
          return;
        }
        if (canAdvance) {
          advanceToNext();
        }
        return;
      }

      if (interactionLocked) return;
      if (!activeQuestion || !Array.isArray(activeQuestion.options)) return;

      const optionIndex = key === 'a' ? 0 : key === 'b' ? 1 : key === 'c' ? 2 : key === 'd' ? 3 : -1;
      if (optionIndex === -1) return;
      const option = activeQuestion.options[optionIndex];
      if (option == null) return;
      submitAnswer(option);
    };

    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [activeQuestion, advanceToNext, canAdvance, interactionLocked, inQuiz, isReviewing, submitAnswer]);

  if (!inQuiz && !showResult) {
    return (
      <div className="quiz-setup">
        <h2>Start a New Quiz</h2>
        <p className="setup-subtitle">Choose a category and your starting difficulty. The quiz adapts as you go.</p>

        {error && <div className="error-message">{error}</div>}

        <div className="setup-form">
          <div className="form-group">
            <label>Category</label>
            <select value={category} onChange={(e) => setCategory(e.target.value)} disabled={setupDisabled}>
              <option value="all">All Categories</option>
              {CATEGORIES.map((cat) => (
                <option key={cat} value={cat}>{cat}</option>
              ))}
            </select>
          </div>

          <div className="form-group">
            <label>Adaptive Difficulty Start</label>
            <select value={difficulty} onChange={(e) => setDifficulty(e.target.value)} disabled={setupDisabled}>
              {DIFFICULTIES.map((diff) => (
                <option key={diff} value={diff}>{diff.charAt(0).toUpperCase() + diff.slice(1)}</option>
              ))}
            </select>
          </div>

          <button onClick={startQuiz} className="start-btn" disabled={loading}>
            {loading ? 'Loading...' : 'Start Quiz'}
          </button>
        </div>
      </div>
    );
  }

  if (showResult) {
    return (
      <div className="quiz-result">
        <h1>Quiz Complete!</h1>

        <div className="result-card">
          {!result && (
            <div className="result-message">
              Calculating results...
            </div>
          )}

          <div className="score-circle">
            <svg className="score-circle-svg" viewBox="0 0 150 150">
              <defs>
                <linearGradient id="gradient" x1="0%" y1="0%" x2="100%" y2="100%">
                  <stop offset="0%" stopColor="#667eea" />
                  <stop offset="100%" stopColor="#764ba2" />
                </linearGradient>
              </defs>
              <circle className="score-circle-bg" cx="75" cy="75" r="65" />
              <circle
                className="score-circle-progress"
                cx="75"
                cy="75"
                r="65"
                style={{ strokeDashoffset: 408 - (408 * animatedPercentage) / 100 }}
              />
            </svg>
            <div className="score-circle-inner">
              <span className="score-value">{animatedPercentage}%</span>
            </div>
          </div>

          <div className="result-stats">
            <div className="stat">
              <span className="stat-label">Score</span>
              <span className="stat-value">{result?.score ?? 0}</span>
            </div>
            <div className="stat">
              <span className="stat-label">Correct</span>
              <span className="stat-value">{correctAnswers}</span>
            </div>
            <div className="stat">
              <span className="stat-label">Total</span>
              <span className="stat-value">{result?.totalQuestions ?? 0}</span>
            </div>
          </div>

          <div className="result-message">
            {percentage >= 80 ? 'Excellent!' : percentage >= 60 ? 'Good job!' : 'Keep practicing!'}
          </div>

          <div className="result-actions">
            <button
              type="button"
              className="review-toggle-btn"
              onClick={() => setReviewOpen(v => !v)}
              disabled={!attempt}
            >
              {reviewOpen ? 'Hide Review' : 'Review Answers'}
            </button>

            <button onClick={resetRunState} className="play-again-btn">
              New Quiz
            </button>
          </div>

          {reviewOpen && (
            <div className="review-section">
              <h2>Answer Review</h2>

              {reviewLoading && (
                <div className="review-loading">
                  <div className="spinner"></div>
                </div>
              )}

              {reviewError && <div className="error-message">{reviewError}</div>}

              {!reviewLoading && attempt && Array.isArray(attempt.questions) && (
                <div className="review-list">
                  {attempt.questions.map((q, idx) => {
                    const correct = normalize(q.correctAnswer);
                    const user = normalize(q.userAnswer);
                    const skipped = !q.userAnswer;

                    return (
                      <details key={q.questionId || idx} className="review-item">
                        <summary className="review-summary">
                          <span className="review-q">Question {idx + 1}</span>
                          <span className={`review-badge ${skipped ? 'skipped' : q.isCorrect ? 'correct' : 'wrong'}`}>
                            {skipped ? 'Skipped' : q.isCorrect ? 'Correct' : 'Wrong'}
                          </span>
                        </summary>

                        <div className="review-body">
                          <div className="review-question-text">{q.questionText || 'Question'}</div>

                          <div className="review-options">
                            {(q.options || []).map((opt, optIdx) => {
                              const optNorm = normalize(opt);
                              const isCorrect = optNorm === correct;
                              const isUser = !!q.userAnswer && optNorm === user;
                              const isWrongPick = isUser && !isCorrect;

                              return (
                                <div
                                  key={`${idx}-${optIdx}`}
                                  className={
                                    `review-option ` +
                                    (isCorrect ? 'correct' : '') +
                                    (isWrongPick ? ' wrong' : '') +
                                    (isUser ? ' selected' : '')
                                  }
                                >
                                  <span className="review-option-letter">{String.fromCharCode(65 + optIdx)}</span>
                                  <span className="review-option-text">{opt}</span>
                                </div>
                              );
                            })}
                          </div>

                          <div className="review-meta">
                            <div>
                              <strong>Your Answer:</strong> {q.userAnswer ?? 'Skipped'}
                            </div>
                            <div>
                              <strong>Correct Answer:</strong> {q.correctAnswer ?? '-'}
                            </div>
                          </div>

                          {q.explanation ? (
                            <div className="review-explanation">
                              <strong>Explanation:</strong> {q.explanation}
                            </div>
                          ) : null}
                        </div>
                      </details>
                    );
                  })}
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    );
  }

  if (!question && !activeQuestion) {
    return (
      <div className="quiz-loading">
        <div className="spinner"></div>
        <p>Loading question...</p>
      </div>
    );
  }

  return (
    <div className="quiz-container">
      {antiCheatWarning && (
        <div className="anti-cheat-banner">
          <div className="anti-cheat-icon">!</div>
          <div className="anti-cheat-text">
            <div className="anti-cheat-title">{antiCheatWarning.headline}</div>
            <div className="anti-cheat-detail">{antiCheatWarning.detail}</div>
          </div>
        </div>
      )}

      <div className="quiz-header">
        <div className="question-progress">
          {isReviewing ? 'Reviewing' : 'Question'} {activeIndex + 1} of {progress.total}
        </div>

        <div className="timer" data-state={timerState}>
          <span className="timer-icon">T</span>
          {timeLeft}s
        </div>

        <div className="current-score">
          <span className="difficulty-label">Difficulty</span>
          <span className={`difficulty-value badge-${currentDifficulty}`}>{currentDifficulty}</span>
        </div>
      </div>

      <div className="progress-bar">
        <div
          className="progress-fill"
          style={{ width: `${progress.total > 0 ? ((progress.index + 1) / progress.total) * 100 : 0}%` }}
        ></div>
      </div>

      <div className="quiz-shell">
        <div className="quiz-main">
          <div className="question-card">
            <h2 className="question-text">{activeQuestion?.question}</h2>

            {activeEntry && (
              <div className={`answer-feedback ${activeEntry.isCorrect ? 'correct' : 'wrong'}`}>
                {activeEntry.skipped
                  ? activeEntry.autoSkipped
                    ? `Time's up. Correct answer: ${activeEntry.correctAnswer ?? 'Unavailable'}`
                    : `Skipped. Correct answer: ${activeEntry.correctAnswer ?? 'Unavailable'}`
                  : activeEntry.isCorrect
                    ? 'Correct answer.'
                    : `Incorrect. Correct answer: ${activeEntry.correctAnswer ?? 'Unavailable'}`}
              </div>
            )}

            {isReviewing && (
              <div className="review-note">Review mode. Answers are locked.</div>
            )}

            <div className="options-grid">
              {(activeQuestion?.options || []).map((option, index) => {
                const isSelected = activeEntry
                  ? activeEntry.userAnswer === option
                  : selectedAnswer === option;
                const showFeedback = !!activeEntry;
                const isCorrect = showFeedback && activeEntry?.correctAnswer === option;
                const isWrong = showFeedback && activeEntry?.userAnswer === option && !activeEntry?.isCorrect;
                return (
                  <button
                    key={index}
                    className={`option-btn ${isSelected ? 'selected' : ''} ${isCorrect ? 'correct' : ''} ${isWrong ? 'wrong' : ''}`}
                    onClick={() => submitAnswer(option)}
                    disabled={interactionLocked}
                  >
                    <span className="option-letter">{String.fromCharCode(65 + index)}</span>
                    {option}
                  </button>
                );
              })}
            </div>

            <div className="quiz-actions">
              {isReviewing ? (
                <button type="button" className="quiz-action-btn primary" onClick={() => setViewIndex(null)}>
                  Return to current
                </button>
              ) : canAdvance ? (
                <button type="button" className="quiz-action-btn primary" onClick={advanceToNext}>
                  Next Question
                </button>
              ) : (
                <button type="button" className="quiz-action-btn" onClick={() => submitAnswer(null)} disabled={interactionLocked}>
                  Skip
                </button>
              )}
              <button type="button" className="quiz-action-btn danger" onClick={abandon}>
                End Quiz
              </button>
            </div>
          </div>
        </div>

        <aside className="question-nav">
          <div className="question-nav-title">Questions</div>
          <div className="question-nav-grid">
            {Array.from({ length: progress.total }).map((_, idx) => {
              const isCurrent = idx === progress.index && !isReviewing;
              const isAnswered = idx < progress.index;
              const hasEntry = !!questionHistory[idx];
              const canJump = isAnswered && hasEntry;
              const statusClass = isCurrent ? 'current' : isAnswered ? 'answered' : 'unanswered';
              return (
                <button
                  key={idx}
                  type="button"
                  className={`nav-btn ${statusClass}`}
                  onClick={() => (canJump ? setViewIndex(idx) : null)}
                  disabled={!canJump && !isCurrent}
                >
                  {idx + 1}
                </button>
              );
            })}
          </div>
          <div className="question-nav-legend">
            <span className="legend-item"><span className="legend-dot answered"></span>Answered</span>
            <span className="legend-item"><span className="legend-dot current"></span>Current</span>
            <span className="legend-item"><span className="legend-dot unanswered"></span>Not answered</span>
          </div>
          {isReviewing && (
            <button type="button" className="question-nav-return" onClick={() => setViewIndex(null)}>
              Return to current question
            </button>
          )}
        </aside>
      </div>
    </div>
  );
};

export default Quiz;
