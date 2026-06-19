import { useState, useEffect } from 'react';
import API from '../services/api';
import './Leaderboard.css';

const Leaderboard = () => {
  const [leaderboard, setLeaderboard] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [pagination, setPagination] = useState({ page: 1, limit: 10, total: 0, pages: 0 });
  const [filters, setFilters] = useState({ category: '', difficulty: '', timeframe: '' });

  const fetchLeaderboard = async (page = 1) => {
    setLoading(true);
    setError(null);
    
    try {
      const params = new URLSearchParams();
      params.append('page', page);
      params.append('limit', 10);
      if (filters.category) params.append('category', filters.category);
      if (filters.difficulty) params.append('difficulty', filters.difficulty);
      if (filters.timeframe) params.append('timeframe', filters.timeframe);
      
      const response = await API.get(`/scores/leaderboard?${params}`);
      setLeaderboard(response.data.data);
      setPagination(response.data.pagination);
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to load leaderboard');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchLeaderboard();
  }, [filters]);

  const handlePageChange = (newPage) => {
    if (newPage >= 1 && newPage <= pagination.pages) {
      fetchLeaderboard(newPage);
    }
  };

  const handleFilterChange = (key, value) => {
    setFilters((prev) => ({ ...prev, [key]: value }));
  };

  return (
    <div className="leaderboard-container">
      <h1>Leaderboard</h1>
      
      <div className="filters-bar">
        <select
          value={filters.category}
          onChange={(e) => handleFilterChange('category', e.target.value)}
        >
          <option value="">All Categories</option>
          <option value="Science">Science</option>
          <option value="History">History</option>
          <option value="Geography">Geography</option>
          <option value="Sports">Sports</option>
          <option value="Entertainment">Entertainment</option>
          <option value="Technology">Technology</option>
          <option value="General Knowledge">General Knowledge</option>
        </select>
        
        <select
          value={filters.difficulty}
          onChange={(e) => handleFilterChange('difficulty', e.target.value)}
        >
          <option value="">All Difficulties</option>
          <option value="easy">Easy</option>
          <option value="medium">Medium</option>
          <option value="hard">Hard</option>
        </select>
        
        <select
          value={filters.timeframe}
          onChange={(e) => handleFilterChange('timeframe', e.target.value)}
        >
          <option value="">All Time</option>
          <option value="day">Today</option>
          <option value="week">This Week</option>
          <option value="month">This Month</option>
        </select>
      </div>
      
      {error && <div className="error-message">{error}</div>}
      
      {loading ? (
        <div className="loading">
          <div className="spinner"></div>
        </div>
      ) : leaderboard.length === 0 ? (
        <div className="empty-state">
          <p>No scores yet. Be the first to play!</p>
        </div>
      ) : (
        <>
          <table className="leaderboard-table">
            <thead>
              <tr>
                <th>Rank</th>
                <th>Player</th>
                <th>Best Score</th>
                <th>Quizzes</th>
                <th>Avg %</th>
                <th>Last Played</th>
              </tr>
            </thead>
            <tbody>
              {leaderboard.map((entry, index) => (
                <tr key={entry.userId} className={index < 3 ? `top-${index + 1}` : ''}>
                  <td className="rank">
                    {index + 1 + (pagination.page - 1) * pagination.limit}
                  </td>
                  <td className="player">
                    <span className="avatar">{entry.username.charAt(0).toUpperCase()}</span>
                    {entry.username}
                  </td>
                  <td className="score">{entry.bestScore}</td>
                  <td>{entry.totalQuizzes}</td>
                  <td>{entry.averagePercentage}%</td>
                  <td className="date">
                    {new Date(entry.lastPlayed).toLocaleDateString()}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          
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

export default Leaderboard;
