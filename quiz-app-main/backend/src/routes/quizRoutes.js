const express = require('express');
const router = express.Router();

const { auth } = require('../middleware/auth');
const {
  startSession,
  getActiveSession,
  getSession,
  answerCurrent,
  recordEvent,
  abandonSession,
  finishSession
} = require('../controllers/quizController');

router.post('/sessions', auth, startSession);
router.get('/sessions/active', auth, getActiveSession);
router.get('/sessions/:id', auth, getSession);
router.post('/sessions/:id/answer', auth, answerCurrent);
router.post('/sessions/:id/events', auth, recordEvent);
router.post('/sessions/:id/abandon', auth, abandonSession);
router.post('/sessions/:id/finish', auth, finishSession);

module.exports = router;
