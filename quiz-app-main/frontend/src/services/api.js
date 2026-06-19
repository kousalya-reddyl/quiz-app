import axios from 'axios';

const API = axios.create({
  baseURL: (import.meta.env.VITE_API_URL || 'http://localhost:5000') + '/api',
  timeout: 10000,
  headers: {
    'Content-Type': 'application/json'
  }
});

let isRefreshing = false;
let failedQueue = [];

const processQueue = (error, token = null) => {
  failedQueue.forEach(prom => {
    if (error) {
      prom.reject(error);
    } else {
      prom.resolve(token);
    }
  });
  failedQueue = [];
};

// Request interceptor with logging
API.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem('accessToken');
    console.log(`[API REQUEST] ${config.method?.toUpperCase()} ${config.url}`);
    console.log(`[API REQUEST] Token exists: ${!!token}`);
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => Promise.reject(error)
);

// Response interceptor
API.interceptors.response.use(
  (response) => {
    console.log(`[API RESPONSE] ${response.config.method?.toUpperCase()} ${response.config.url} - ${response.status}`);
    return response;
  },
  async (error) => {
    const originalRequest = error.config;
    
    console.log(`[API ERROR] ${error.config?.method?.toUpperCase()} ${error.config?.url} - ${error.response?.status}`);
    console.log(`[API ERROR] Response:`, error.response?.data);
    
    if (error.response?.status === 401 && error.response?.data?.code === 'TOKEN_EXPIRED' && !originalRequest._retry) {
      if (isRefreshing) {
        return new Promise((resolve, reject) => {
          failedQueue.push({ resolve, reject });
        })
          .then(token => {
            originalRequest.headers.Authorization = `Bearer ${token}`;
            return API(originalRequest);
          })
          .catch(err => Promise.reject(err));
      }
      
      originalRequest._retry = true;
      isRefreshing = true;
      
      const refreshToken = localStorage.getItem('refreshToken');
      
      if (!refreshToken) {
        console.log('[API] No refresh token, redirecting to login');
        localStorage.clear();
        window.location.href = '/login';
        return Promise.reject(error);
      }
      
      try {
        const response = await axios.post(
          `${API.defaults.baseURL}/auth/refresh-token`,
          { refreshToken }
        );
        
        const { accessToken, refreshToken: newRefreshToken } = response.data.data;
        
        localStorage.setItem('accessToken', accessToken);
        localStorage.setItem('refreshToken', newRefreshToken);
        
        processQueue(null, accessToken);
        originalRequest.headers.Authorization = `Bearer ${accessToken}`;
        
        return API(originalRequest);
      } catch (refreshError) {
        processQueue(refreshError, null);
        localStorage.clear();
        window.location.href = '/login';
        return Promise.reject(refreshError);
      } finally {
        isRefreshing = false;
      }
    }
    
    if (error.response?.status === 401) {
      console.log('[API] 401 Unauthorized, redirecting to login');
      localStorage.clear();
      window.location.href = '/login';
    }
    
    return Promise.reject(error);
  }
);

export default API;
