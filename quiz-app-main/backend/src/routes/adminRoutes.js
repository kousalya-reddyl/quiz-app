const express = require('express');
const router = express.Router();
const { auth } = require('../middleware/auth');
const { adminOnly } = require('../middleware/admin');
const {
  getDashboardStats,
  getUsers,
  getUserById,
  updateUser,
  deleteUser,
  getAllQuestions,
  bulkCreateQuestions
} = require('../controllers/adminController');
const { paginationValidator, questionValidator } = require('../validators');

router.get('/dashboard', auth, adminOnly, getDashboardStats);
router.get('/users', auth, adminOnly, getUsers);
router.get('/users/:id', auth, adminOnly, getUserById);
router.put('/users/:id', auth, adminOnly, updateUser);
router.delete('/users/:id', auth, adminOnly, deleteUser);
router.get('/questions', auth, adminOnly, getAllQuestions);
router.post('/questions/bulk', auth, adminOnly, bulkCreateQuestions);

module.exports = router;
