const jwt = require('jsonwebtoken');
const config = require('../config');
const { User, RefreshToken } = require('../models');

const generateTokens = async (user, req) => {
  const accessToken = jwt.sign(
    { id: user._id, role: user.role, username: user.username },
    config.JWT_SECRET,
    { expiresIn: config.JWT_EXPIRES_IN }
  );
  
  const refreshToken = await RefreshToken.createToken(
    user,
    req.get('User-Agent'),
    req.ip
  );
  
  return { accessToken, refreshToken };
};

const register = async (req, res, next) => {
  try {
    const { username, email, password } = req.body;
    
    const existingUser = await User.findOne({ username });
    if (existingUser) {
      return res.status(400).json({
        success: false,
        message: 'Username already exists'
      });
    }
    
    if (email) {
      const existingEmail = await User.findOne({ email });
      if (existingEmail) {
        return res.status(400).json({
          success: false,
          message: 'Email already registered'
        });
      }
    }
    
    const user = await User.create({
      username,
      email: email || null,
      password
    });
    
    const { accessToken, refreshToken } = await generateTokens(user, req);
    
    res.status(201).json({
      success: true,
      message: 'Registration successful',
      data: {
        user: user.toJSON(),
        accessToken,
        refreshToken
      }
    });
  } catch (error) {
    next(error);
  }
};

const login = async (req, res, next) => {
  try {
    const { username, password } = req.body;
    
    const user = await User.findOne({ username }).select('+password');
    
    if (!user) {
      return res.status(401).json({
        success: false,
        message: 'Invalid credentials'
      });
    }
    
    if (!user.isActive) {
      return res.status(401).json({
        success: false,
        message: 'Account is deactivated'
      });
    }
    
    if (user.isLocked()) {
      return res.status(429).json({
        success: false,
        message: 'Account temporarily locked. Please try again later.',
        retryAfter: Math.ceil((user.lockUntil - Date.now()) / 1000)
      });
    }
    
    const isMatch = await user.comparePassword(password);
    
    if (!isMatch) {
      await user.incrementLoginAttempts();
      return res.status(401).json({
        success: false,
        message: 'Invalid credentials'
      });
    }
    
    await user.updateOne({
      $set: { 
        lastLogin: new Date(),
        loginAttempts: 0
      },
      $unset: { lockUntil: 1 }
    });
    
    await RefreshToken.revokeAllUserTokens(user._id);
    
    const { accessToken, refreshToken } = await generateTokens(user, req);
    
    res.json({
      success: true,
      message: 'Login successful',
      data: {
        user: user.toJSON(),
        accessToken,
        refreshToken
      }
    });
  } catch (error) {
    next(error);
  }
};

const refreshToken = async (req, res, next) => {
  try {
    const { refreshToken: token } = req.body;
    
    if (!token) {
      return res.status(400).json({
        success: false,
        message: 'Refresh token required'
      });
    }
    
    const storedToken = await RefreshToken.findOne({ token, isRevoked: false });
    
    if (!storedToken) {
      return res.status(401).json({
        success: false,
        message: 'Invalid refresh token'
      });
    }
    
    if (storedToken.expiresAt < new Date()) {
      return res.status(401).json({
        success: false,
        message: 'Refresh token expired'
      });
    }
    
    const user = await User.findById(storedToken.user);
    
    if (!user || !user.isActive) {
      return res.status(401).json({
        success: false,
        message: 'User not found or inactive'
      });
    }
    
    await RefreshToken.revokeToken(token);
    
    const tokens = await generateTokens(user, req);
    
    res.json({
      success: true,
      data: {
        accessToken: tokens.accessToken,
        refreshToken: tokens.refreshToken
      }
    });
  } catch (error) {
    next(error);
  }
};

const getMe = async (req, res, next) => {
  try {
    const user = await User.findById(req.user._id);
    
    res.json({
      success: true,
      data: user
    });
  } catch (error) {
    next(error);
  }
};

const logout = async (req, res, next) => {
  try {
    const { refreshToken } = req.body;
    
    if (refreshToken) {
      await RefreshToken.revokeToken(refreshToken);
    }
    
    if (req.token) {
      await RefreshToken.revokeAllUserTokens(req.user._id);
    }
    
    res.json({
      success: true,
      message: 'Logged out successfully'
    });
  } catch (error) {
    next(error);
  }
};

const changePassword = async (req, res, next) => {
  try {
    const { currentPassword, newPassword } = req.body;
    
    const user = await User.findById(req.user._id).select('+password');
    
    const isMatch = await user.comparePassword(currentPassword);
    if (!isMatch) {
      return res.status(400).json({
        success: false,
        message: 'Current password is incorrect'
      });
    }
    
    user.password = newPassword;
    await user.save();
    
    await RefreshToken.revokeAllUserTokens(user._id);
    
    res.json({
      success: true,
      message: 'Password changed successfully'
    });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  register,
  login,
  refreshToken,
  getMe,
  logout,
  changePassword
};
