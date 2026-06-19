const express = require('express');
const router = express.Router();
const { register, login, refreshToken, getMe, logout, changePassword } = require('../controllers/authController');
const { auth } = require('../middleware/auth');
const { registerValidator, loginValidator } = require('../validators');

router.post('/register', registerValidator, register);
router.post('/login', loginValidator, login);
router.post('/refresh-token', refreshToken);
router.post('/logout', auth, logout);
router.get('/me', auth, getMe);
router.post('/change-password', auth, changePassword);

module.exports = router;
