const express = require('express');
const router = express.Router();
const { auth, optionalAuth } = require('../middleware/auth');
const { admin, adminOnly } = require('../middleware/admin');
const {
  getQuestions,
  getQuestionById,
  createQuestion,
  updateQuestion,
  deleteQuestion,
  getCategories,
  getQuestionStats
} = require('../controllers/questionController');
const { questionValidator } = require('../validators');

router.get('/', optionalAuth, getQuestions);
router.get('/categories', getCategories);
router.get('/stats', auth, adminOnly, getQuestionStats);
router.get('/:id', auth, getQuestionById);
router.post('/', auth, admin, questionValidator, createQuestion);
router.put('/:id', auth, admin, updateQuestion);
router.delete('/:id', auth, admin, deleteQuestion);

module.exports = router;
