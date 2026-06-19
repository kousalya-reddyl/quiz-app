const { body, query, validationResult } = require('express-validator');

const validate = (req, res, next) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({
      success: false,
      message: 'Validation failed',
      errors: errors.array().map(e => ({
        field: e.path,
        message: e.msg
      }))
    });
  }
  next();
};

const registerValidator = [
  body('username')
    .trim()
    .isLength({ min: 3, max: 30 })
    .withMessage('Username must be between 3 and 30 characters')
    .matches(/^[a-zA-Z0-9_]+$/)
    .withMessage('Username can only contain letters, numbers, and underscores'),
  
  body('email')
    .optional({ nullable: true, checkFalsy: true })
    .isEmail()
    .withMessage('Please provide a valid email')
    .normalizeEmail(),
  
  body('password')
    .isLength({ min: 8 })
    .withMessage('Password must be at least 8 characters')
    .matches(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/)
    .withMessage('Password must contain at least one uppercase letter, one lowercase letter, and one number'),
  
  validate
];

const loginValidator = [
  body('username')
    .trim()
    .notEmpty()
    .withMessage('Username is required'),
  
  body('password')
    .notEmpty()
    .withMessage('Password is required'),
  
  validate
];

const questionValidator = [
  body('question')
    .trim()
    .isLength({ min: 10, max: 500 })
    .withMessage('Question must be between 10 and 500 characters'),
  
  body('options')
    .isArray({ min: 2, max: 6 })
    .withMessage('Options must be between 2 and 6'),
  
  body('options.*')
    .trim()
    .notEmpty()
    .withMessage('All options must be filled'),
  
  body('correctAnswer')
    .trim()
    .notEmpty()
    .withMessage('Correct answer is required')
    .custom((value, { req }) => {
      if (!req.body.options.includes(value)) {
        throw new Error('Correct answer must be one of the options');
      }
      return true;
    }),
  
  body('category')
    .optional()
    .isIn(['Science', 'History', 'Geography', 'Sports', 'Entertainment', 'Technology', 'General Knowledge'])
    .withMessage('Invalid category'),
  
  body('difficulty')
    .optional()
    .isIn(['easy', 'medium', 'hard'])
    .withMessage('Invalid difficulty'),

  body('topic')
    .optional()
    .isString()
    .isLength({ min: 2, max: 60 })
    .withMessage('Topic must be between 2 and 60 characters'),
  
  body('timeLimit')
    .optional()
    .isInt({ min: 10, max: 120 })
    .withMessage('Time limit must be between 10 and 120 seconds'),
  
  validate
];

const scoreValidator = [
  body('category')
    .optional()
    .isString(),
  
  body('difficulty')
    .optional()
    .isIn(['easy', 'medium', 'hard', 'mixed', 'all']),

  body('answers')
    .isArray({ min: 1 })
    .withMessage('Answers must be a non-empty array'),

  body('answers.*.questionId')
    .notEmpty()
    .withMessage('Each answer must include questionId')
    .bail()
    .isMongoId()
    .withMessage('questionId must be a valid MongoDB ObjectId'),

  body('answers.*.userAnswer')
    .optional({ nullable: true })
    .isString()
    .withMessage('userAnswer must be a string'),

  body('answers.*.timeSpent')
    .optional()
    .isInt({ min: 0, max: 600 })
    .withMessage('timeSpent must be between 0 and 600 seconds'),
  
  validate
];

const paginationValidator = [
  query('page')
    .optional()
    .isInt({ min: 1 })
    .withMessage('Page must be a positive integer'),
  
  query('limit')
    .optional()
    .isInt({ min: 1, max: 100 })
    .withMessage('Limit must be between 1 and 100'),
  
  validate
];

const leaderboardValidator = [
  ...paginationValidator,
  query('category')
    .optional()
    .isString(),
  
  query('difficulty')
    .optional()
    .isIn(['easy', 'medium', 'hard', 'mixed', 'all']),
  
  query('timeframe')
    .optional()
    .isIn(['day', 'week', 'month', 'all'])
    .withMessage('Invalid timeframe')
];

module.exports = {
  validate,
  registerValidator,
  loginValidator,
  questionValidator,
  scoreValidator,
  paginationValidator,
  leaderboardValidator
};
