import { useEffect, useState } from 'react';
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  CartesianGrid
} from 'recharts';
import API from '../services/api';
import './LearningDashboard.css';

const LearningDashboard = () => {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      setError(null);
      try {
        const res = await API.get('/scores/learning');
        setData(res.data.data);
      } catch (e) {
        setError(e.response?.data?.message || 'Failed to load learning dashboard');
      } finally {
        setLoading(false);
      }
    };

    load();
  }, []);

  if (loading) {
    return (
      <div className="dashboard-loading">
        <div className="spinner"></div>
      </div>
    );
  }

  const overview = data?.overview || {};
  const scoreTrend = data?.scoreTrend || [];
  const weakTopics = data?.weakTopics || [];
  const recommendations = data?.recommendations || [];
  const topicPerformance = data?.topicPerformance || [];
  const mistakeAnalysis = data?.mistakeAnalysis || [];

  const xp = overview.xp || 0;
  const xpNextLevel = overview.xpNextLevel || 100;
  const xpProgress = Math.min(100, Math.round((xp / xpNextLevel) * 100));

  return (
    <div className="learning-dashboard">
      <div className="dashboard-header">
        <div>
          <h1>Learning Dashboard</h1>
          <p>Track your growth, streaks, and focus areas.</p>
        </div>
      </div>

      {error && <div className="error-message">{error}</div>}

      <div className="dashboard-grid">
        <div className="stat-card">
          <span className="stat-label">Total Quizzes</span>
          <span className="stat-value">{overview.totalQuizzes || 0}</span>
        </div>
        <div className="stat-card">
          <span className="stat-label">Accuracy</span>
          <span className="stat-value">{overview.accuracy || 0}%</span>
        </div>
        <div className="stat-card">
          <span className="stat-label">Current Streak</span>
          <span className="stat-value">{overview.currentStreak || 0} days</span>
        </div>
        <div className="stat-card">
          <span className="stat-label">Longest Streak</span>
          <span className="stat-value">{overview.longestStreak || 0} days</span>
        </div>
      </div>

      <div className="dashboard-panels">
        <div className="panel">
          <div className="panel-header">
            <h2>Score Progress</h2>
            <span className="panel-sub">Last 20 quizzes</span>
          </div>
          {scoreTrend.length === 0 ? (
            <div className="empty-state">Play a quiz to see your progress.</div>
          ) : (
            <div className="chart-wrap">
              <ResponsiveContainer width="100%" height={260}>
                <LineChart data={scoreTrend} margin={{ top: 10, right: 16, left: 0, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                  <XAxis dataKey="date" tick={{ fontSize: 12 }} />
                  <YAxis domain={[0, 100]} tick={{ fontSize: 12 }} />
                  <Tooltip />
                  <Line type="monotone" dataKey="percentage" stroke="#4f46e5" strokeWidth={3} dot={{ r: 3 }} />
                </LineChart>
              </ResponsiveContainer>
            </div>
          )}
        </div>

        <div className="panel">
          <div className="panel-header">
            <h2>Level Progress</h2>
            <span className="panel-sub">Level {overview.level || 1}</span>
          </div>
          <div className="xp-block">
            <div className="xp-top">
              <span>XP</span>
              <span>{xp} / {xpNextLevel}</span>
            </div>
            <div className="xp-bar">
              <div className="xp-fill" style={{ width: `${xpProgress}%` }}></div>
            </div>
            <p className="xp-note">Earn XP by answering questions correctly.</p>
          </div>
        </div>
      </div>

      <div className="dashboard-panels">
        <div className="panel">
          <div className="panel-header">
            <h2>Weak Topics</h2>
            <span className="panel-sub">Focus areas</span>
          </div>
          {weakTopics.length === 0 ? (
            <div className="empty-state">Not enough data yet.</div>
          ) : (
            <div className="topic-list">
              {weakTopics.map((t) => (
                <div className="topic-row" key={t.topic}>
                  <div>
                    <div className="topic-name">{t.topic}</div>
                    <div className="topic-meta">{t.total} questions</div>
                  </div>
                  <div className="topic-accuracy">{t.accuracy}%</div>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="panel">
          <div className="panel-header">
            <h2>Smart Recommendations</h2>
            <span className="panel-sub">Next practice suggestions</span>
          </div>
          {recommendations.length === 0 ? (
            <div className="empty-state">Play more quizzes to get recommendations.</div>
          ) : (
            <div className="recommendations">
              {recommendations.map((r) => (
                <div className="recommendation" key={r.topic}>
                  <span className="recommendation-topic">{r.topic}</span>
                  <span className="recommendation-reason">{r.reason}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      <div className="panel">
        <div className="panel-header">
          <h2>Topic Performance</h2>
          <span className="panel-sub">Accuracy by topic</span>
        </div>
        {topicPerformance.length === 0 ? (
          <div className="empty-state">No topic data yet.</div>
        ) : (
          <div className="topic-table">
            {topicPerformance.map((t) => (
              <div className="topic-table-row" key={t.topic}>
                <span>{t.topic}</span>
                <span>{t.correct}/{t.total}</span>
                <span>{t.accuracy}%</span>
              </div>
            ))}
          </div>
        )}
      </div>

      {mistakeAnalysis.length > 0 && (
        <div className="panel mistake-analysis">
          <div className="panel-header">
            <h2>Mistake Analysis</h2>
            <span className="panel-sub">Review questions you got wrong</span>
          </div>
          <div className="mistake-topics">
            {mistakeAnalysis.map((topic) => (
              <details key={topic.topic} className="mistake-topic">
                <summary className="mistake-topic-header">
                  <span className="mistake-topic-name">{topic.topic}</span>
                  <span className="mistake-count">{topic.mistakeCount} mistake{topic.mistakeCount > 1 ? 's' : ''}</span>
                </summary>
                <div className="mistake-questions">
                  {topic.questions.map((q, idx) => (
                    <div key={q.questionId || idx} className="mistake-question">
                      <div className="mistake-q-text">{idx + 1}. {q.questionText}</div>
                      <div className="mistake-q-answers">
                        <span className="your-answer wrong">Your answer: {q.userAnswer || 'Skipped'}</span>
                        <span className="correct-answer">Correct: {q.correctAnswer}</span>
                      </div>
                    </div>
                  ))}
                </div>
              </details>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

export default LearningDashboard;
