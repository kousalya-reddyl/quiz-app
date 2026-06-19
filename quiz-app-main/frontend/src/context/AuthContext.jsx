import { createContext, useContext, useState, useEffect } from 'react';
import API from '../services/api';

const AuthContext = createContext(null);

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    const token = localStorage.getItem('accessToken');
    const storedUser = localStorage.getItem('user');
    
    if (token && storedUser) {
      setUser(JSON.parse(storedUser));
      fetchUser();
    }
    setLoading(false);
  }, []);

  const fetchUser = async () => {
    try {
      const response = await API.get('/auth/me');
      setUser(response.data.data);
      localStorage.setItem('user', JSON.stringify(response.data.data));
    } catch (err) {
      logout();
    }
  };

  const login = async (username, password) => {
    try {
      setError(null);
      const response = await API.post('/auth/login', { username, password });
      const { user, accessToken, refreshToken } = response.data.data;
      
      localStorage.setItem('accessToken', accessToken);
      localStorage.setItem('refreshToken', refreshToken);
      localStorage.setItem('user', JSON.stringify(user));
      
      setUser(user);
      return { success: true };
    } catch (err) {
      const message = err.response?.data?.message || 'Login failed';
      setError(message);
      return { success: false, message };
    }
  };

  const register = async (username, email, password) => {
    try {
      setError(null);
      await API.post('/auth/register', { username, email, password });
      return { success: true, message: 'Registration successful! Please login.' };
    } catch (err) {
      const message = err.response?.data?.message || 'Registration failed';
      setError(message);
      return { success: false, message };
    }
  };

  const logout = async () => {
    try {
      const refreshToken = localStorage.getItem('refreshToken');
      await API.post('/auth/logout', { refreshToken });
    } catch {
    } finally {
      localStorage.removeItem('accessToken');
      localStorage.removeItem('refreshToken');
      localStorage.removeItem('user');
      setUser(null);
    }
  };

  const updateUser = (updates) => {
    setUser(prev => {
      const updated = { ...prev, ...updates };
      localStorage.setItem('user', JSON.stringify(updated));
      return updated;
    });
  };

  const refreshUser = async () => {
    try {
      const response = await API.get('/auth/me');
      setUser(response.data.data);
      localStorage.setItem('user', JSON.stringify(response.data.data));
    } catch (err) {
      console.error('Failed to refresh user:', err);
    }
  };

  return (
    <AuthContext.Provider value={{
      user,
      loading,
      error,
      login,
      register,
      logout,
      updateUser,
      refreshUser,
      isAuthenticated: !!user,
      isAdmin: user?.role === 'admin'
    }}>
      {children}
    </AuthContext.Provider>
  );
};
