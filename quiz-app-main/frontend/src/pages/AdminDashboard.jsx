import { useState, useEffect } from 'react';
import API from '../services/api';
import { Link } from 'react-router-dom';
import './Admin.css';

const CATEGORIES = ['Science', 'History', 'Geography', 'Sports', 'Entertainment', 'Technology', 'General Knowledge'];
const DIFFICULTIES = ['easy', 'medium', 'hard'];

const AdminDashboard = () => {
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [activeTab, setActiveTab] = useState('overview');
  const [questions, setQuestions] = useState([]);
  const [users, setUsers] = useState([]);
  const [attempts, setAttempts] = useState([]);
  const [attemptsPagination, setAttemptsPagination] = useState({ page: 1, limit: 20, total: 0, pages: 0 });
  const [suspiciousOnly, setSuspiciousOnly] = useState(true);
  const [editingQuestion, setEditingQuestion] = useState(null);
  const [showModal, setShowModal] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [newQuestion, setNewQuestion] = useState({
    question: '',
    options: ['', '', '', ''],
    correctAnswer: '',
    category: 'General Knowledge',
    difficulty: 'medium',
    topic: 'General',
    timeLimit: 30,
    points: 10,
    explanation: ''
  });

  const fetchDashboard = async () => {
    setLoading(true);
    setError(null);
    
    try {
      const response = await API.get('/admin/dashboard');
      setStats(response.data.data);
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to load dashboard');
    } finally {
      setLoading(false);
    }
  };

  const fetchQuestions = async (page = 1) => {
    try {
      const response = await API.get(`/admin/questions?page=${page}&limit=20`);
      setQuestions(response.data.data);
    } catch (err) {
      console.error('Failed to fetch questions:', err);
    }
  };

  const fetchUsers = async (page = 1) => {
    try {
      const response = await API.get(`/admin/users?page=${page}&limit=20`);
      setUsers(response.data.data);
    } catch (err) {
      console.error('Failed to fetch users:', err);
    }
  };

  const fetchAttempts = async (page = 1) => {
    try {
      const params = new URLSearchParams();
      params.append('page', page);
      params.append('limit', 20);
      if (suspiciousOnly) params.append('suspicious', 'true');

      const response = await API.get(`/admin/attempts?${params}`);
      setAttempts(response.data.data);
      setAttemptsPagination(response.data.pagination || { page: 1, limit: 20, total: 0, pages: 0 });
    } catch (err) {
      console.error('Failed to fetch attempts:', err);
    }
  };

  useEffect(() => {
    fetchDashboard();
  }, []);

  useEffect(() => {
    if (activeTab === 'questions') fetchQuestions();
    if (activeTab === 'users') fetchUsers();
    if (activeTab === 'security') fetchAttempts();
  }, [activeTab]);

  useEffect(() => {
    if (activeTab === 'security') fetchAttempts(1);
  }, [suspiciousOnly]);

  const handleAddQuestion = async (e) => {
    e.preventDefault();
    
    try {
      await API.post('/questions', newQuestion);
      alert('Question added successfully!');
      setNewQuestion({
        question: '',
        options: ['', '', '', ''],
        correctAnswer: '',
        category: 'General Knowledge',
        difficulty: 'medium',
        topic: 'General',
        timeLimit: 30,
        points: 10,
        explanation: ''
      });
      fetchDashboard();
    } catch (err) {
      alert(err.response?.data?.message || 'Failed to add question');
    }
  };

  const handleOptionChange = (index, value) => {
    const newOptions = [...newQuestion.options];
    newOptions[index] = value;
    setNewQuestion({ ...newQuestion, options: newOptions });
  };

  const handleDeleteQuestion = async (id) => {
    if (!confirm('Are you sure you want to delete this question?')) return;
    
    try {
      await API.delete(`/questions/${id}`);
      fetchQuestions();
      fetchDashboard();
    } catch (err) {
      alert(err.response?.data?.message || 'Failed to delete question');
    }
  };

  const handleEditQuestion = (question) => {
      setEditingQuestion({
        _id: question._id,
        question: question.question,
        options: question.options || ['', '', '', ''],
        correctAnswer: question.correctAnswer || '',
        category: question.category || 'General Knowledge',
        difficulty: question.difficulty || 'medium',
        topic: question.topic || 'General',
        timeLimit: question.timeLimit || 30,
        points: question.points || 10,
        explanation: question.explanation || ''
      });
    setShowModal(true);
  };

  const handleUpdateQuestion = async (e) => {
    e.preventDefault();
    setSubmitting(true);
    
    try {
      await API.put(`/questions/${editingQuestion._id}`, editingQuestion);
      alert('Question updated successfully!');
      setShowModal(false);
      setEditingQuestion(null);
      fetchQuestions();
      fetchDashboard();
    } catch (err) {
      alert(err.response?.data?.message || 'Failed to update question');
    } finally {
      setSubmitting(false);
    }
  };

  const handleEditOptionChange = (index, value) => {
    const newOptions = [...editingQuestion.options];
    newOptions[index] = value;
    setEditingQuestion({ ...editingQuestion, options: newOptions });
  };

  const closeModal = () => {
    setShowModal(false);
    setEditingQuestion(null);
  };

  const toggleUserActive = async (userId, isActive) => {
    try {
      await API.put(`/admin/users/${userId}`, { isActive: !isActive });
      fetchUsers();
    } catch (err) {
      alert(err.response?.data?.message || 'Failed to update user');
    }
  };

  if (loading) {
    return (
      <div className="admin-loading">
        <div className="spinner"></div>
      </div>
    );
  }

  return (
    <div className="admin-container">
      <h1>Admin Dashboard</h1>
      
      {error && <div className="error-message">{error}</div>}
      
      <div className="admin-tabs">
        <button
          className={activeTab === 'overview' ? 'active' : ''}
          onClick={() => setActiveTab('overview')}
        >
          Overview
        </button>
        <button
          className={activeTab === 'add-question' ? 'active' : ''}
          onClick={() => setActiveTab('add-question')}
        >
          Add Question
        </button>
        <button
          className={activeTab === 'questions' ? 'active' : ''}
          onClick={() => setActiveTab('questions')}
        >
          Manage Questions
        </button>
        <button
          className={activeTab === 'users' ? 'active' : ''}
          onClick={() => setActiveTab('users')}
        >
          Manage Users
        </button>
        <button
          className={activeTab === 'security' ? 'active' : ''}
          onClick={() => setActiveTab('security')}
        >
          Security
        </button>
      </div>
      
      {activeTab === 'overview' && stats && (
        <div className="admin-overview">
          <div className="overview-cards">
            <div className="overview-card">
              <div className="card-icon">👥</div>
              <div className="card-content">
                <span className="card-value">{stats.overview.totalUsers}</span>
                <span className="card-label">Total Users</span>
              </div>
            </div>
            
            <div className="overview-card">
              <div className="card-icon">❓</div>
              <div className="card-content">
                <span className="card-value">{stats.overview.totalQuestions}</span>
                <span className="card-label">Questions</span>
              </div>
            </div>
            
            <div className="overview-card">
              <div className="card-icon">🎮</div>
              <div className="card-content">
                <span className="card-value">{stats.overview.totalQuizzes}</span>
                <span className="card-label">Quizzes Played</span>
              </div>
            </div>
            
            <div className="overview-card">
              <div className="card-icon">📊</div>
              <div className="card-content">
                <span className="card-value">{stats.overview.avgScore}</span>
                <span className="card-label">Avg Score</span>
              </div>
            </div>
          </div>
          
          <div className="charts-grid">
            <div className="chart-card">
              <h3>Questions by Difficulty</h3>
              <div className="chart-bars">
                <div className="bar-item">
                  <span>Easy</span>
                  <div className="bar">
                    <div className="bar-fill easy" style={{ width: `${(stats.questionBreakdown.easy / stats.overview.totalQuestions) * 100}%` }}></div>
                  </div>
                  <span>{stats.questionBreakdown.easy}</span>
                </div>
                <div className="bar-item">
                  <span>Medium</span>
                  <div className="bar">
                    <div className="bar-fill medium" style={{ width: `${(stats.questionBreakdown.medium / stats.overview.totalQuestions) * 100}%` }}></div>
                  </div>
                  <span>{stats.questionBreakdown.medium}</span>
                </div>
                <div className="bar-item">
                  <span>Hard</span>
                  <div className="bar">
                    <div className="bar-fill hard" style={{ width: `${(stats.questionBreakdown.hard / stats.overview.totalQuestions) * 100}%` }}></div>
                  </div>
                  <span>{stats.questionBreakdown.hard}</span>
                </div>
              </div>
            </div>
            
            <div className="chart-card">
              <h3>Recent Attempts</h3>
              {stats.overview?.suspiciousLast7Days > 0 && (
                <div style={{ marginBottom: '0.75rem', fontWeight: 700, color: '#b51d2a' }}>
                  Suspicious (7d): {stats.overview.suspiciousLast7Days}
                </div>
              )}
              <div className="recent-list">
                {stats.recentQuizzes.map((quiz) => (
                  <div key={quiz._id} className="recent-item">
                    <span>{quiz.user?.username || 'Unknown'}</span>
                    <span>Score: {quiz.score}</span>
                    {quiz.suspicious ? (
                      <span title={(quiz.suspiciousReasons || []).join(', ') || 'Suspicious'} style={{ color: '#b51d2a', fontWeight: 800 }}>
                        FLAGGED
                      </span>
                    ) : (
                      <span></span>
                    )}
                    <span>{new Date(quiz.completedAt).toLocaleDateString()}</span>
                    <Link to={`/attempt/${quiz._id}`} style={{ fontWeight: 700 }}>View</Link>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}
      
      {activeTab === 'add-question' && (
        <div className="add-question-form">
          <h2>Add New Question</h2>
          
          <form onSubmit={handleAddQuestion}>
            <div className="form-group">
              <label>Question</label>
              <textarea
                value={newQuestion.question}
                onChange={(e) => setNewQuestion({ ...newQuestion, question: e.target.value })}
                placeholder="Enter your question..."
                required
              />
            </div>
            
            <div className="form-row">
              <div className="form-group">
                <label>Category</label>
                <select
                  value={newQuestion.category}
                  onChange={(e) => setNewQuestion({ ...newQuestion, category: e.target.value })}
                >
                  <option>Science</option>
                  <option>History</option>
                  <option>Geography</option>
                  <option>Sports</option>
                  <option>Entertainment</option>
                  <option>Technology</option>
                  <option>General Knowledge</option>
                </select>
              </div>

              <div className="form-group">
                <label>Difficulty</label>
                <select
                  value={newQuestion.difficulty}
                  onChange={(e) => setNewQuestion({ ...newQuestion, difficulty: e.target.value })}
                >
                  <option value="easy">Easy</option>
                  <option value="medium">Medium</option>
                  <option value="hard">Hard</option>
                </select>
              </div>
            </div>

            <div className="form-group">
              <label>Topic</label>
              <input
                type="text"
                value={newQuestion.topic}
                onChange={(e) => setNewQuestion({ ...newQuestion, topic: e.target.value })}
                placeholder="e.g. Algebra, World War II"
                required
              />
            </div>
            
            <div className="options-group">
              <label>Options</label>
              {newQuestion.options.map((opt, i) => (
                <input
                  key={i}
                  type="text"
                  value={opt}
                  onChange={(e) => handleOptionChange(i, e.target.value)}
                  placeholder={`Option ${i + 1}`}
                  required
                />
              ))}
            </div>
            
            <div className="form-group">
              <label>Correct Answer</label>
              <input
                type="text"
                value={newQuestion.correctAnswer}
                onChange={(e) => setNewQuestion({ ...newQuestion, correctAnswer: e.target.value })}
                placeholder="Enter the correct answer (must match one option)"
                required
              />
            </div>
            
            <div className="form-row">
              <div className="form-group">
                <label>Time Limit (seconds)</label>
                <input
                  type="number"
                  value={newQuestion.timeLimit}
                  onChange={(e) => setNewQuestion({ ...newQuestion, timeLimit: parseInt(e.target.value) })}
                  min={10}
                  max={120}
                />
              </div>
              
              <div className="form-group">
                <label>Points</label>
                <input
                  type="number"
                  value={newQuestion.points}
                  onChange={(e) => setNewQuestion({ ...newQuestion, points: parseInt(e.target.value) })}
                  min={1}
                  max={100}
                />
              </div>
            </div>
            
            <button type="submit" className="submit-btn">Add Question</button>
          </form>
        </div>
      )}
      
      {activeTab === 'questions' && (
        <div className="questions-management">
          <h2>Manage Questions</h2>
          <div className="questions-list">
            {questions.map((q) => (
              <div key={q._id} className="question-item">
                <div className="question-content">
                  <p>{q.question}</p>
                  <div className="question-meta">
                    <span className="badge">{q.category}</span>
                    <span className="badge">{q.difficulty}</span>
                    <span className="badge">{q.topic || 'General'}</span>
                  </div>
                </div>
                <div className="question-actions">
                  <button
                    className="edit-btn"
                    onClick={() => handleEditQuestion(q)}
                  >
                    Edit
                  </button>
                  <button
                    className="delete-btn"
                    onClick={() => handleDeleteQuestion(q._id)}
                  >
                    Delete
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
      
      {activeTab === 'users' && (
        <div className="users-management">
          <h2>Manage Users</h2>
          <div className="users-list">
            {users.map((u) => (
              <div key={u._id} className="user-item">
                <div className="user-info">
                  <span className="user-name">{u.username}</span>
                  <span className="user-email">{u.email || 'No email'}</span>
                </div>
                <span className="user-role">{u.role}</span>
                <button
                  className={`toggle-btn ${u.isActive ? 'active' : ''}`}
                  onClick={() => toggleUserActive(u._id, u.isActive)}
                >
                  {u.isActive ? 'Active' : 'Inactive'}
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {activeTab === 'security' && (
        <div className="security-management">
          <div className="security-header">
            <h2>Suspicious Attempts</h2>
            <div className="security-actions">
              <button
                className={`toggle-btn ${suspiciousOnly ? 'active' : ''}`}
                onClick={() => setSuspiciousOnly(v => !v)}
              >
                {suspiciousOnly ? 'Showing Flagged' : 'Showing All'}
              </button>
            </div>
          </div>

          {attempts.length === 0 ? (
            <div className="empty-state">
              <p>No attempts found.</p>
            </div>
          ) : (
            <div className="attempts-list">
              {attempts.map((a) => (
                <div key={a._id} className={`attempt-item ${a.suspicious ? 'flagged' : ''}`}>
                  <div className="attempt-main">
                    <div className="attempt-user">{a.user?.username || 'Unknown'}</div>
                    <div className="attempt-score">{a.score} / {a.maxScore}</div>
                    <div className="attempt-percent">{a.percentage}%</div>
                  </div>
                  <div className="attempt-meta">
                    <span>{new Date(a.completedAt).toLocaleDateString()}</span>
                    {a.suspicious ? (
                      <span className="attempt-flag" title={(a.suspiciousReasons || []).join(', ') || 'Suspicious'}>
                        FLAGGED
                      </span>
                    ) : (
                      <span></span>
                    )}
                    <Link to={`/attempt/${a._id}`} className="attempt-link">View</Link>
                  </div>
                </div>
              ))}
            </div>
          )}

          {attemptsPagination.pages > 1 && (
            <div className="pagination">
              <button
                onClick={() => fetchAttempts(attemptsPagination.page - 1)}
                disabled={attemptsPagination.page === 1}
              >
                Previous
              </button>
              <span className="page-info">
                Page {attemptsPagination.page} of {attemptsPagination.pages}
              </span>
              <button
                onClick={() => fetchAttempts(attemptsPagination.page + 1)}
                disabled={attemptsPagination.page === attemptsPagination.pages}
              >
                Next
              </button>
            </div>
          )}
        </div>
      )}
      
      {showModal && editingQuestion && (
        <div className="modal-overlay" onClick={closeModal}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h2>Edit Question</h2>
              <button className="modal-close" onClick={closeModal}>&times;</button>
            </div>
            
            <form onSubmit={handleUpdateQuestion}>
              <div className="form-group">
                <label>Question</label>
                <textarea
                  value={editingQuestion.question}
                  onChange={(e) => setEditingQuestion({ ...editingQuestion, question: e.target.value })}
                  placeholder="Enter your question..."
                  required
                />
              </div>
              
              <div className="form-row">
                <div className="form-group">
                  <label>Category</label>
                  <select
                    value={editingQuestion.category}
                    onChange={(e) => setEditingQuestion({ ...editingQuestion, category: e.target.value })}
                  >
                    {CATEGORIES.map(cat => (
                      <option key={cat} value={cat}>{cat}</option>
                    ))}
                  </select>
                </div>
                
                <div className="form-group">
                  <label>Difficulty</label>
                  <select
                    value={editingQuestion.difficulty}
                    onChange={(e) => setEditingQuestion({ ...editingQuestion, difficulty: e.target.value })}
                  >
                    {DIFFICULTIES.map(diff => (
                      <option key={diff} value={diff}>{diff.charAt(0).toUpperCase() + diff.slice(1)}</option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="form-group">
                <label>Topic</label>
                <input
                  type="text"
                  value={editingQuestion.topic}
                  onChange={(e) => setEditingQuestion({ ...editingQuestion, topic: e.target.value })}
                  placeholder="e.g. Algebra, World War II"
                  required
                />
              </div>
              
              <div className="form-group">
                <label>Options</label>
                {editingQuestion.options.map((opt, i) => (
                  <input
                    key={i}
                    type="text"
                    value={opt}
                    onChange={(e) => handleEditOptionChange(i, e.target.value)}
                    placeholder={`Option ${i + 1}`}
                    required
                  />
                ))}
              </div>
              
              <div className="form-group">
                <label>Correct Answer</label>
                <input
                  type="text"
                  value={editingQuestion.correctAnswer}
                  onChange={(e) => setEditingQuestion({ ...editingQuestion, correctAnswer: e.target.value })}
                  placeholder="Enter the correct answer"
                  required
                />
              </div>
              
              <div className="form-row">
                <div className="form-group">
                  <label>Time Limit (seconds)</label>
                  <input
                    type="number"
                    value={editingQuestion.timeLimit}
                    onChange={(e) => setEditingQuestion({ ...editingQuestion, timeLimit: parseInt(e.target.value) })}
                    min={10}
                    max={120}
                  />
                </div>
                
                <div className="form-group">
                  <label>Points</label>
                  <input
                    type="number"
                    value={editingQuestion.points}
                    onChange={(e) => setEditingQuestion({ ...editingQuestion, points: parseInt(e.target.value) })}
                    min={1}
                    max={100}
                  />
                </div>
              </div>
              
              <div className="form-group">
                <label>Explanation (optional)</label>
                <textarea
                  value={editingQuestion.explanation}
                  onChange={(e) => setEditingQuestion({ ...editingQuestion, explanation: e.target.value })}
                  placeholder="Explanation for the correct answer..."
                />
              </div>
              
              <div className="modal-actions">
                <button type="button" className="cancel-btn" onClick={closeModal}>
                  Cancel
                </button>
                <button type="submit" className="submit-btn" disabled={submitting}>
                  {submitting ? 'Updating...' : 'Update Question'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default AdminDashboard;
