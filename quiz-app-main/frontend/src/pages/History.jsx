import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import API from '../services/api';
import { useAuth } from '../context/AuthContext';
import './History.css';

const History = () => {
  const [history, setHistory] = useState([]);
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [pagination, setPagination] = useState({ page: 1, limit: 10, total: 0, pages: 0 });
  const { user, refreshUser } = useAuth();

  const fetchHistory = async (page = 1) => {
    setLoading(true);
    setError(null);
    
    try {
      console.log('=== DEBUG: Fetching history ===');
      console.log('Token in localStorage:', localStorage.getItem('accessToken') ? 'EXISTS' : 'MISSING');
      console.log('User in context:', user);
      
      const [historyRes, statsRes] = await Promise.all([
        API.get(`/scores/history?page=${page}&limit=10`),
        API.get('/scores/stats')
      ]);
      
      console.log('History response:', historyRes.data);
      console.log('Stats response:', statsRes.data);
      
      setHistory(historyRes.data.data || []);
      setPagination(historyRes.data.pagination || { page: 1, limit: 10, total: 0, pages: 0 });
      setStats(statsRes.data.data || null);
    } catch (err) {
      console.error('Error fetching history:', err);
      console.error('Error response:', err.response?.data);
      setError(err.response?.data?.message || 'Failed to load history');
    } finally {
      setLoading(false);
    }
  };

  // Fetch history when component mounts and when user changes
  useEffect(() => {
    fetchHistory();
    // Also refresh user profile to get latest stats
    if (refreshUser) {
      refreshUser();
    }
  }, []);

  const handlePageChange = (newPage) => {
    if (newPage >= 1 && newPage <= pagination.pages) {
      fetchHistory(newPage);
    }
  };

  if (loading) {
    return (
      <div className="history-loading">
        <div className="spinner"></div>
      </div>
    );
  }

  return (
    <div className="history-container">
      <div className="history-header">
        <h1>My Quiz History</h1>
        <button onClick={() => fetchHistory()} className="refresh-btn" title="Refresh">
          🔄
        </button>
      </div>
      
      {error && <div className="error-message">{error}</div>}
      
      {stats && stats.totalQuizzes > 0 ? (
        <div className="stats-grid">
          <div className="stat-card">
            <div className="stat-icon">🎯</div>
            <div className="stat-content">
              <span className="stat-value">{stats.totalQuizzes || 0}</span>
              <span className="stat-label">Total Quizzes</span>
            </div>
          </div>
          
          <div className="stat-card">
            <div className="stat-icon">🏆</div>
            <div className="stat-content">
              <span className="stat-value">{stats.bestScore || 0}</span>
              <span className="stat-label">Best Score</span>
            </div>
          </div>
          
          <div className="stat-card">
            <div className="stat-icon">📊</div>
            <div className="stat-content">
              <span className="stat-value">{Math.round(stats.averageScore) || 0}</span>
              <span className="stat-label">Avg Score</span>
            </div>
          </div>
          
          <div className="stat-card">
            <div className="stat-icon">📈</div>
            <div className="stat-content">
              <span className="stat-value">{stats.averagePercentage || 0}%</span>
              <span className="stat-label">Avg Percentage</span>
            </div>
          </div>
        </div>
      ) : (
        <div className="empty-stats">
          <p>Complete a quiz to see your stats!</p>
        </div>
      )}
      
      <h2>Recent Quizzes</h2>
      
      {history.length === 0 ? (
        <div className="empty-state">
          <p>You haven't played any quizzes yet!</p>
          <button onClick={() => window.location.href = '/'} className="btn-primary">
            Start Quiz
          </button>
        </div>
      ) : (
        <>
          <div className="history-list">
            {history.map((quiz) => (
              <Link key={quiz._id} to={`/attempt/${quiz._id}`} className="history-card-link">
                <div className="history-card">
                  <div className="history-info">
                    <div className="history-category">{quiz.category}</div>
                    <div className="history-difficulty">{quiz.difficulty}</div>
                  </div>
                  
                  <div className="history-score">
                    <span className="score-value">{quiz.score}</span>
                    <span className="score-max">/ {quiz.totalQuestions * 10}</span>
                  </div>
                  
                  <div className="history-details">
                    <span>{quiz.correctAnswers}/{quiz.totalQuestions} correct</span>
                    <span>{quiz.percentage}%</span>
                  </div>
                  
                  <div className="history-date">
                    {new Date(quiz.completedAt).toLocaleDateString()}
                  </div>
                </div>
              </Link>
            ))}
          </div>
          
          {pagination.pages > 1 && (
            <div className="pagination">
              <button
                onClick={() => handlePageChange(pagination.page - 1)}
                disabled={pagination.page === 1}
              >
                Previous
              </button>
              <span className="page-info">
                Page {pagination.page} of {pagination.pages}
              </span>
              <button
                onClick={() => handlePageChange(pagination.page + 1)}
                disabled={pagination.page === pagination.pages}
              >
                Next
              </button>
            </div>
          )}
        </>
      )}
    </div>
  );
};

export default History;
