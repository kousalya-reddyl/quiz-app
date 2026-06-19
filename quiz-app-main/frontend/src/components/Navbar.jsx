import { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import './Navbar.css';

const Navbar = () => {
  const { user, isAuthenticated, isAdmin, logout } = useAuth();
  const navigate = useNavigate();
  const [darkMode, setDarkMode] = useState(() => {
    return localStorage.getItem('theme') === 'dark';
  });

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', darkMode ? 'dark' : 'light');
    localStorage.setItem('theme', darkMode ? 'dark' : 'light');
  }, [darkMode]);

  const handleLogout = async () => {
    await logout();
    navigate('/login');
  };

  const toggleDarkMode = () => {
    setDarkMode(!darkMode);
  };

  if (!isAuthenticated) return null;

  return (
    <nav className="navbar">
      <div className="navbar-brand">
        <Link to="/">QuizMaster</Link>
      </div>
      
      <div className="navbar-links">
        <Link to="/" className="nav-link">Quiz</Link>
        <Link to="/dashboard" className="nav-link">Dashboard</Link>
        <Link to="/leaderboard" className="nav-link">Leaderboard</Link>
        <Link to="/history" className="nav-link">My History</Link>
        {isAdmin && (
          <Link to="/admin" className="nav-link admin-link">Admin</Link>
        )}
      </div>

      <div className="navbar-user">
        <button 
          onClick={toggleDarkMode} 
          className="theme-toggle"
          title={darkMode ? 'Switch to light mode' : 'Switch to dark mode'}
        >
          {darkMode ? '☀️' : '🌙'}
        </button>
        <span className="username">{user?.username}</span>
        <span className="role-badge">{user?.role}</span>
        <button onClick={handleLogout} className="logout-btn">
          Logout
        </button>
      </div>
    </nav>
  );
};

export default Navbar;
