const jwt = require('jsonwebtoken');
const config = require('../config');
const { User } = require('../models');

const auth = async (req, res, next) => {
  try {
    const authHeader = req.header('Authorization');
    
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({
        success: false,
        message: 'Access denied. No token provided.'
      });
    }
    
    const token = authHeader.replace('Bearer ', '');
    
    try {
      const decoded = jwt.verify(token, config.JWT_SECRET);
      console.log('[AUTH] Decoded JWT:', decoded);
      
      const user = await User.findById(decoded.id);
      console.log('[AUTH] Found user:', user ? { _id: user._id, username: user.username, profile: user.profile } : 'NOT FOUND');
      
      if (!user || !user.isActive) {
        return res.status(401).json({
          success: false,
          message: 'Invalid token or user inactive.'
        });
      }
      
      req.user = user;
      req.token = token;
      next();
    } catch (jwtError) {
      if (jwtError.name === 'TokenExpiredError') {
        return res.status(401).json({
          success: false,
          message: 'Token expired',
          code: 'TOKEN_EXPIRED'
        });
      }
      return res.status(400).json({
        success: false,
        message: 'Invalid token.'
      });
    }
  } catch (error) {
    console.error('Auth middleware error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error'
    });
  }
};

const optionalAuth = async (req, res, next) => {
  try {
    const authHeader = req.header('Authorization');
    
    if (authHeader && authHeader.startsWith('Bearer ')) {
      const token = authHeader.replace('Bearer ', '');
      const decoded = jwt.verify(token, config.JWT_SECRET);
      const user = await User.findById(decoded.id);
      
      if (user && user.isActive) {
        req.user = user;
        req.token = token;
      }
    }
    next();
  } catch {
    next();
  }
};

module.exports = { auth, optionalAuth };
