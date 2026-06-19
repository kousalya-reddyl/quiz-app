require('dotenv').config();

const isProduction = process.env.NODE_ENV === 'production';

module.exports = {
  PORT: process.env.PORT || 5000,
  MONGODB_URI: process.env.MONGODB_URI || process.env.MONGO_URI,
  JWT_SECRET: process.env.JWT_SECRET,
  JWT_REFRESH_SECRET: process.env.JWT_REFRESH_SECRET,
  JWT_EXPIRES_IN: process.env.JWT_EXPIRES_IN || '15m',
  JWT_REFRESH_EXPIRES_IN: process.env.JWT_REFRESH_EXPIRES_IN || '7d',
  PASSWORD_MIN_LENGTH: 8,
  QUESTIONS_PER_QUIZ: 10,
  
  // Rate Limiting Configuration
  // Development: More relaxed limits
  // Production: Strict limits
  RATE_LIMIT: {
    // Login route - strict to prevent brute force
    LOGIN: {
      windowMs: isProduction ? 15 * 60 * 1000 : 15 * 60 * 1000,
      max: isProduction ? 5 : 10,
      message: 'Too many login attempts. Please try again later.',
      skipSuccessfulRequests: true
    },
    
    // General API routes - moderate
    GENERAL: {
      windowMs: isProduction ? 60 * 1000 : 60 * 1000,
      max: isProduction ? 100 : 200,
      message: 'Too many requests. Please slow down.'
    },
    
    // Admin routes - controlled
    ADMIN: {
      windowMs: isProduction ? 10 * 60 * 1000 : 10 * 60 * 1000,
      max: isProduction ? 30 : 100,
      message: 'Admin rate limit exceeded. Please try again later.'
    },
    
    // Quiz gameplay - very lenient to prevent interruption
    QUIZ: {
      windowMs: 60 * 1000,
      max: isProduction ? 60 : 120,
      message: 'Quiz request limit exceeded.'
    }
  }
};
