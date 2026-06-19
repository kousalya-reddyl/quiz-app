const { auth, optionalAuth } = require('./auth');
const { admin, adminOnly } = require('./admin');
const { errorHandler, notFoundHandler, AppError } = require('./errorHandler');

module.exports = {
  auth,
  optionalAuth,
  admin,
  adminOnly,
  errorHandler,
  notFoundHandler,
  AppError
};
