import { BrowserRouter as Router, Routes, Route, Navigate, useLocation } from 'react-router-dom';
import { AuthProvider } from './context/AuthContext';
import ProtectedRoute from './components/ProtectedRoute';
import Navbar from './components/Navbar';
import { ToastProvider } from './components/Toast';
import Login from './pages/Login';
import Register from './pages/Register';
import Quiz from './pages/Quiz';
import Leaderboard from './pages/Leaderboard';
import History from './pages/History';
import Attempt from './pages/Attempt';
import AdminDashboard from './pages/AdminDashboard';
import LearningDashboard from './pages/LearningDashboard';
import './index.css';

function AppContent() {
  const location = useLocation();
  const isAuth = location.pathname === '/login' || location.pathname === '/register';

  return (
    <div className="app">
      {!isAuth && <Navbar />}
      <main className="main-content">
        <Routes>
          <Route path="/login" element={<Login />} />
          <Route path="/register" element={<Register />} />
          
          <Route path="/" element={
            <ProtectedRoute>
              <Quiz />
            </ProtectedRoute>
          } />
          
          <Route path="/leaderboard" element={
            <ProtectedRoute>
              <Leaderboard />
            </ProtectedRoute>
          } />

          <Route path="/dashboard" element={
            <ProtectedRoute>
              <LearningDashboard />
            </ProtectedRoute>
          } />
          
          <Route path="/history" element={
            <ProtectedRoute>
              <History />
            </ProtectedRoute>
          } />

          <Route path="/attempt/:id" element={
            <ProtectedRoute>
              <Attempt />
            </ProtectedRoute>
          } />
          
          <Route path="/admin" element={
            <ProtectedRoute adminOnly>
              <AdminDashboard />
            </ProtectedRoute>
          } />
          
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </main>
    </div>
  );
}

function App() {
  return (
    <AuthProvider>
      <Router>
        <ToastProvider />
        <AppContent />
      </Router>
    </AuthProvider>
  );
}

export default App;
