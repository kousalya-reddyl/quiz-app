const express = require('express');
const router = express.Router();
const { auth } = require('../middleware/auth');
const {
  submitScore,
  getLeaderboard,
  getUserHistory,
  getUserStats,
  getMyBestScores,
  getScoreAttempt,
  getLearningDashboard
} = require('../controllers/scoreController');
const { scoreValidator, leaderboardValidator, paginationValidator } = require('../validators');

router.post('/', auth, scoreValidator, submitScore);
router.get('/leaderboard', auth, leaderboardValidator, getLeaderboard);
router.get('/history', auth, paginationValidator, getUserHistory);
router.get('/stats', auth, getUserStats);
router.get('/learning', auth, getLearningDashboard);
router.get('/best', auth, getMyBestScores);
router.get('/stats/:userId', auth, getUserStats);
router.get('/:id', auth, getScoreAttempt);

module.exports = router;
