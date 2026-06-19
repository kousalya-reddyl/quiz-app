const AppError = require('../utils/AppError');

const handleCastError = (err) => {
  const message = `Invalid ${err.path}: ${err.value}`;
  return new AppError(message, 400);
};

const handleDuplicateFields = (err) => {
  const field = Object.keys(err.keyValue)[0];
  const value = err.keyValue[field];
  const message = `Duplicate field value: ${field}. Please use another ${field}.`;
  return new AppError(message, 400);
};

const handleValidationError = (err) => {
  const errors = Object.values(err.errors).map(e => e.message);
  const message = `Validation failed: ${errors.join('. ')}`;
  return new AppError(message, 400);
};

const handleJWTError = () => {
  return new AppError('Invalid token. Please log in again.', 401);
};

const handleJWTExpiredError = () => {
  return new AppError('Your token has expired. Please log in again.', 401);
};

const sendErrorDev = (err, res) => {
  res.status(err.statusCode).json({
    success: false,
    message: err.message,
    stack: err.stack,
    error: err
  });
};

const sendErrorProd = (err, res) => {
  if (err.isOperational) {
    return res.status(err.statusCode).json({
      success: false,
      message: err.message
    });
  }
  
  console.error('ERROR:', err);
  
  res.status(500).json({
    success: false,
    message: 'Something went wrong'
  });
};

const errorHandler = (err, req, res, next) => {
  let error = { ...err };
  error.message = err.message;
  error.statusCode = err.statusCode || 500;
  
  if (err.name === 'CastError') error = handleCastError(err);
  if (err.code === 11000) error = handleDuplicateFields(err);
  if (err.name === 'ValidationError') error = handleValidationError(err);
  if (err.name === 'JsonWebTokenError') error = handleJWTError();
  if (err.name === 'TokenExpiredError') error = handleJWTExpiredError();
  
  if (process.env.NODE_ENV === 'development') {
    sendErrorDev(error, res);
  } else {
    sendErrorProd(error, res);
  }
};

const notFoundHandler = (req, res, next) => {
  const error = new AppError(`Route ${req.originalUrl} not found`, 404);
  next(error);
};

module.exports = {
  errorHandler,
  notFoundHandler,
  AppError
};
