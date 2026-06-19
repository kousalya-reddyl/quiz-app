const mongoose = require('mongoose');

const askedSchema = new mongoose.Schema({
  questionId: { type: mongoose.Schema.Types.ObjectId, ref: 'Question', required: true },
  difficulty: { type: String, default: 'medium' },
  userAnswer: { type: String, default: null },
  isCorrect: { type: Boolean, default: false },
  timeSpent: { type: Number, default: 0 },
  points: { type: Number, default: 0 },
  pointsEarned: { type: Number, default: 0 },
  answeredAt: { type: Date, default: Date.now }
}, { _id: false });

const eventSchema = new mongoose.Schema({
  type: { type: String, required: true },
  at: { type: Date, default: Date.now }
}, { _id: false });

const quizSessionSchema = new mongoose.Schema({
  user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  status: { type: String, enum: ['active', 'completed', 'abandoned'], default: 'active' },
  category: { type: String, default: 'General Knowledge' },
  targetCount: { type: Number, default: 10 },
  currentIndex: { type: Number, default: 0 },
  currentDifficulty: { type: String, default: 'medium' },
  score: { type: Number, default: 0 },
  maxScore: { type: Number, default: 0 },
  correctAnswers: { type: Number, default: 0 },
  currentQuestionId: { type: mongoose.Schema.Types.ObjectId, ref: 'Question', default: null },
  currentQuestionStartedAt: { type: Date, default: null },
  currentQuestionTimeLimit: { type: Number, default: 30 },
  asked: { type: [askedSchema], default: [] },
  violations: {
    tabSwitches: { type: Number, default: 0 },
    blurs: { type: Number, default: 0 },
    navigations: { type: Number, default: 0 }
  },
  events: { type: [eventSchema], default: [] },
  attemptId: { type: mongoose.Schema.Types.ObjectId, ref: 'Score', default: null },
  completedAt: { type: Date, default: null },
  expiresAt: { type: Date, default: null }
}, { timestamps: true });

quizSessionSchema.index({ user: 1, status: 1 });
quizSessionSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

module.exports = mongoose.model('QuizSession', quizSessionSchema);
