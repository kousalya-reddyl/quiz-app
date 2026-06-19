const mongoose = require('mongoose');

const scoreSchema = new mongoose.Schema({
  user: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    index: true
  },
  score: {
    type: Number,
    required: [true, 'Score is required'],
    min: [0, 'Score cannot be negative']
  },
  maxScore: {
    type: Number,
    required: [true, 'Max score is required'],
    min: [0, 'Max score cannot be negative']
  },
  totalQuestions: {
    type: Number,
    required: true,
    min: [1, 'Total questions must be at least 1']
  },
  correctAnswers: {
    type: Number,
    required: true,
    min: 0
  },
  category: {
    type: String,
    default: 'General Knowledge'
  },
  difficulty: {
    type: String,
    enum: ['easy', 'medium', 'hard', 'mixed'],
    default: 'mixed'
  },
  timeTaken: {
    type: Number,
    default: 0
  },
  questions: [{
    questionId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Question'
    },
    topic: {
      type: String,
      default: 'General'
    },
    questionText: String,
    options: [String],
    userAnswer: String,
    correctAnswer: String,
    explanation: String,
    isCorrect: Boolean,
    timeSpent: Number,
    points: Number,
    pointsEarned: Number
  }],
  percentage: {
    type: Number,
    required: true
  },
  violations: {
    tabSwitches: { type: Number, default: 0 },
    blurs: { type: Number, default: 0 },
    navigations: { type: Number, default: 0 }
  },
  suspicious: {
    type: Boolean,
    default: false,
    index: true
  },
  suspiciousReasons: {
    type: [String],
    default: []
  },
  completedAt: {
    type: Date,
    default: Date.now
  }
}, {
  timestamps: true
});

scoreSchema.index({ user: 1, completedAt: -1 });
scoreSchema.index({ score: -1 });
scoreSchema.index({ category: 1, difficulty: 1 });
scoreSchema.index({ completedAt: -1 });
scoreSchema.index({ percentage: -1 });
scoreSchema.index({ suspicious: 1, completedAt: -1 });

scoreSchema.statics.getLeaderboard = async function(options = {}) {
  const { page = 1, limit = 10, category, difficulty, timeframe } = options;
  const skip = (page - 1) * limit;
  
  const matchStage = {};
  
  if (category && category !== 'all') matchStage.category = category;
  if (difficulty && difficulty !== 'all') matchStage.difficulty = difficulty;
  if (timeframe && timeframe !== 'all') {
    const startDate = new Date();
    if (timeframe === 'day') startDate.setDate(startDate.getDate() - 1);
    else if (timeframe === 'week') startDate.setDate(startDate.getDate() - 7);
    else if (timeframe === 'month') startDate.setMonth(startDate.getMonth() - 1);
    matchStage.completedAt = { $gte: startDate };
  }
  
  const pipeline = [
    { $match: matchStage },
    {
      $group: {
        _id: '$user',
        bestScore: { $max: '$score' },
        totalQuizzes: { $sum: 1 },
        averagePercentage: { $avg: '$percentage' },
        lastPlayed: { $max: '$completedAt' }
      }
    },
    { $sort: { bestScore: -1 } },
    { $skip: skip },
    { $limit: limit },
    {
      $lookup: {
        from: 'users',
        localField: '_id',
        foreignField: '_id',
        as: 'user'
      }
    },
    { $unwind: '$user' },
    {
      $project: {
        _id: 0,
        userId: '$_id',
        username: '$user.username',
        bestScore: 1,
        totalQuizzes: 1,
        averagePercentage: { $round: ['$averagePercentage', 1] },
        lastPlayed: 1
      }
    }
  ];
  
  return this.aggregate(pipeline);
};

scoreSchema.statics.getUserStats = async function(userId) {
  const stats = await this.aggregate([
    { $match: { user: new mongoose.Types.ObjectId(userId) } },
    {
      $group: {
        _id: null,
        totalQuizzes: { $sum: 1 },
        totalScore: { $sum: '$score' },
        averageScore: { $avg: '$score' },
        averagePercentage: { $avg: '$percentage' },
        bestScore: { $max: '$score' },
        bestPercentage: { $max: '$percentage' },
        totalTime: { $sum: '$timeTaken' },
        categoryBreakdown: {
          $push: '$category'
        }
      }
    }
  ]);
  
  if (stats.length === 0) {
    return {
      totalQuizzes: 0,
      totalScore: 0,
      averageScore: 0,
      averagePercentage: 0,
      bestScore: 0,
      bestPercentage: 0,
      totalTime: 0,
      categoryStats: []
    };
  }
  
  const categoryStats = await this.aggregate([
    { $match: { user: new mongoose.Types.ObjectId(userId) } },
    {
      $group: {
        _id: '$category',
        count: { $sum: 1 },
        averageScore: { $avg: '$score' },
        bestScore: { $max: '$score' }
      }
    }
  ]);
  
  return {
    ...stats[0],
    averageScore: Math.round(stats[0].averageScore || 0),
    averagePercentage: Math.round(stats[0].averagePercentage || 0),
    categoryStats: categoryStats.map(c => ({
      category: c._id,
      count: c.count,
      averageScore: Math.round(c.averageScore || 0),
      bestScore: c.bestScore
    }))
  };
};

module.exports = mongoose.model('Score', scoreSchema);
