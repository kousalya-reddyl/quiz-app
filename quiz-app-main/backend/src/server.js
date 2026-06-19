require('dotenv').config();

const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const rateLimit = require('express-rate-limit');
const connectDB = require('./config/database');
const { errorHandler, notFoundHandler } = require('./middleware/errorHandler');
const requestLogger = require('./middleware/requestLogger');
const { authRoutes, questionRoutes, scoreRoutes, adminRoutes, quizRoutes } = require('./routes');
const config = require('./config');

const app = express();

app.use(helmet({
  crossOriginResourcePolicy: { policy: 'cross-origin' }
}));

app.use(cors({
  origin: process.env.FRONTEND_URL || 'http://localhost:5173',
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH'],
  allowedHeaders: ['Content-Type', 'Authorization']
}));

app.use(express.json({ limit: '10kb' }));
app.use(express.urlencoded({ extended: true, limit: '10kb' }));

if (process.env.NODE_ENV !== 'test') {
  app.use(morgan('dev'));
}

app.use(requestLogger);

// ============================================
// RATE LIMITERS
// ============================================

// Smart rate limiter with route-specific limits
const createSmartLimiter = () => {
  return rateLimit({
    windowMs: 60 * 1000, // 1 minute window
    max: 200, // Default max
    keyGenerator: (req) => {
      // Use different keys for different routes
      const path = req.originalUrl;
      
      if (path.includes('/auth/login')) {
        return `login:${req.ip}`;
      }
      if (path.includes('/auth/register')) {
        return `register:${req.ip}`;
      }
      if (path.includes('/admin')) {
        return `admin:${req.ip}`;
      }
      if (path.includes('/questions') || path.includes('/scores')) {
        return `quiz:${req.ip}`;
      }
      return `general:${req.ip}`;
    },
    handler: (req, res, options) => {
      const path = req.originalUrl;
      let limit = 200;
      let windowMs = 60000;
      
      if (path.includes('/auth/login')) {
        limit = config.RATE_LIMIT.LOGIN.max;
        windowMs = config.RATE_LIMIT.LOGIN.windowMs;
      } else if (path.includes('/auth/register')) {
        limit = config.RATE_LIMIT.GENERAL.max;
      } else if (path.includes('/admin')) {
        limit = config.RATE_LIMIT.ADMIN.max;
        windowMs = config.RATE_LIMIT.ADMIN.windowMs;
      } else if (path.includes('/questions') || path.includes('/scores')) {
        limit = config.RATE_LIMIT.QUIZ.max;
      }
      
      console.log(`[RATE LIMIT] Path: ${path} - IP: ${req.ip} - Limit: ${limit}/${windowMs}ms`);
      
      res.status(429).json({
        success: false,
        message: options.message,
        code: 'RATE_LIMIT_EXCEEDED',
        retryAfter: Math.ceil(windowMs / 1000)
      });
    },
    standardHeaders: true,
    legacyHeaders: false
  });
};

const smartLimiter = createSmartLimiter();

// Apply smart limiter to all API routes
app.use('/api/', smartLimiter);

// Health check - no rate limit (must be AFTER the limiter)
app.get('/api/health', (req, res) => {
  res.json({
    success: true,
    message: 'Quiz App API is running',
    timestamp: new Date().toISOString(),
    version: '1.0.0'
  });
});

// ============================================
// ROUTES
// ============================================

app.use('/api/auth', authRoutes);
app.use('/api/questions', questionRoutes);
app.use('/api/scores', scoreRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/quiz', quizRoutes);

app.use(notFoundHandler);
app.use(errorHandler);

// ============================================
// SERVER START
// ============================================

const startServer = async () => {
  try {
    await connectDB();
    
    console.log(`Rate Limits (${process.env.NODE_ENV || 'development'}):`);
    console.log(`  Login: ${config.RATE_LIMIT.LOGIN.max} requests / ${config.RATE_LIMIT.LOGIN.windowMs / 1000}s`);
    console.log(`  Register: ${config.RATE_LIMIT.GENERAL.max} requests / ${config.RATE_LIMIT.GENERAL.windowMs / 1000}s`);
    console.log(`  General: ${config.RATE_LIMIT.GENERAL.max} requests / ${config.RATE_LIMIT.GENERAL.windowMs / 1000}s`);
    console.log(`  Quiz: ${config.RATE_LIMIT.QUIZ.max} requests / ${config.RATE_LIMIT.QUIZ.windowMs / 1000}s`);
    console.log(`  Admin: ${config.RATE_LIMIT.ADMIN.max} requests / ${config.RATE_LIMIT.ADMIN.windowMs / 1000}s`);
    
    app.listen(config.PORT, () => {
      console.log(`Server running on port ${config.PORT}`);
      console.log(`Environment: ${process.env.NODE_ENV || 'development'}`);
    });
  } catch (error) {
    console.error('Failed to start server:', error);
    process.exit(1);
  }
};

if (require.main === module) {
  startServer();
}

module.exports = app;
