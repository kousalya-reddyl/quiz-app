const { User, Question, Score } = require('../models');

const getDashboardStats = async (req, res, next) => {
  try {
    const [
      totalUsers,
      totalQuestions,
      totalQuizzes,
      recentUsers,
      recentQuizzes,
      questionStats
    ] = await Promise.all([
      User.countDocuments({ role: 'user' }),
      Question.countDocuments({ isActive: true }),
      Score.estimatedDocumentCount(),
      User.find({ role: 'user' }).sort({ createdAt: -1 }).limit(5).select('-password'),
      Score.find().sort({ completedAt: -1 }).limit(10).populate('user', 'username'),
      Question.aggregate([
        { $match: { isActive: true } },
        {
          $group: {
            _id: null,
            total: { $sum: 1 },
            avgTimeLimit: { $avg: '$timeLimit' },
            avgPoints: { $avg: '$points' },
            easy: { $sum: { $cond: [{ $eq: ['$difficulty', 'easy'] }, 1, 0] } },
            medium: { $sum: { $cond: [{ $eq: ['$difficulty', 'medium'] }, 1, 0] } },
            hard: { $sum: { $cond: [{ $eq: ['$difficulty', 'hard'] }, 1, 0] } }
          }
        }
      ])
    ]);
    
    const scoreStats = await Score.aggregate([
      {
        $group: {
          _id: null,
          avgScore: { $avg: '$score' },
          avgPercentage: { $avg: '$percentage' },
          maxScore: { $max: '$score' },
          totalTime: { $sum: '$timeTaken' }
        }
      }
    ]);
    
    const categoryStats = await Score.aggregate([
      {
        $group: {
          _id: '$category',
          count: { $sum: 1 },
          avgScore: { $avg: '$score' }
        }
      },
      { $sort: { count: -1 } }
    ]);
    
    const difficultyStats = await Score.aggregate([
      {
        $group: {
          _id: '$difficulty',
          count: { $sum: 1 },
          avgScore: { $avg: '$score' }
        }
      }
    ]);
    
    const dailyStats = await Score.aggregate([
      {
        $match: {
          completedAt: { $gte: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000) }
        }
      },
      {
        $group: {
          _id: { $dateToString: { format: '%Y-%m-%d', date: '$completedAt' } },
          quizzes: { $sum: 1 },
          avgScore: { $avg: '$score' }
        }
      },
      { $sort: { _id: 1 } },
      { $limit: 30 }
    ]);
    
    res.json({
      success: true,
      data: {
        overview: {
          totalUsers,
          totalQuestions,
          totalQuizzes,
          avgScore: Math.round(scoreStats[0]?.avgScore || 0),
          avgPercentage: Math.round(scoreStats[0]?.avgPercentage || 0)
        },
        recentUsers,
        recentQuizzes,
        questionBreakdown: questionStats[0] || {},
        categoryStats,
        difficultyStats,
        dailyStats
      }
    });
  } catch (error) {
    next(error);
  }
};

const getUsers = async (req, res, next) => {
  try {
    const { page = 1, limit = 20, role, search } = req.query;
    
    const filter = {};
    if (role) filter.role = role;
    if (search) {
      filter.$or = [
        { username: { $regex: search, $options: 'i' } },
        { email: { $regex: search, $options: 'i' } }
      ];
    }
    
    const users = await User.find(filter)
      .select('-password -loginAttempts -lockUntil')
      .sort({ createdAt: -1 })
      .skip((parseInt(page) - 1) * parseInt(limit))
      .limit(parseInt(limit));
    
    const total = await User.countDocuments(filter);
    
    res.json({
      success: true,
      data: users,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        pages: Math.ceil(total / limit)
      }
    });
  } catch (error) {
    next(error);
  }
};

const getUserById = async (req, res, next) => {
  try {
    const user = await User.findById(req.params.id).select('-password -loginAttempts -lockUntil');
    
    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }
    
    const stats = await Score.getUserStats(user._id);
    
    res.json({
      success: true,
      data: {
        ...user.toObject(),
        quizStats: stats
      }
    });
  } catch (error) {
    next(error);
  }
};

const updateUser = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { role, isActive, profile } = req.body;
    
    const user = await User.findById(id);
    
    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }
    
    // Prevent admin from deactivating themselves
    if (id === req.user._id.toString() && isActive === false) {
      return res.status(400).json({
        success: false,
        message: 'Cannot deactivate your own account'
      });
    }
    
    // Prevent demoting or deactivating the last admin
    if (user.role === 'admin' && (role === 'user' || isActive === false)) {
      const adminCount = await User.countDocuments({ role: 'admin', isActive: true });
      if (adminCount <= 1) {
        return res.status(400).json({
          success: false,
          message: 'Cannot deactivate or demote the last admin'
        });
      }
    }
    
    if (role) user.role = role;
    if (isActive !== undefined) user.isActive = isActive;
    if (profile) {
      user.profile = { ...user.profile.toObject(), ...profile };
    }
    
    await user.save();
    
    res.json({
      success: true,
      message: 'User updated successfully',
      data: user
    });
  } catch (error) {
    next(error);
  }
};

const deleteUser = async (req, res, next) => {
  try {
    const { id } = req.params;
    
    if (id === req.user._id.toString()) {
      return res.status(400).json({
        success: false,
        message: 'Cannot delete your own account'
      });
    }
    
    const user = await User.findById(id);
    
    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }
    
    await Score.deleteMany({ user: id });
    await user.deleteOne();
    
    res.json({
      success: true,
      message: 'User deleted successfully'
    });
  } catch (error) {
    next(error);
  }
};

const getAllQuestions = async (req, res, next) => {
  try {
    const { page = 1, limit = 20, category, difficulty, search } = req.query;
    
    const filter = {};
    if (category) filter.category = category;
    if (difficulty) filter.difficulty = difficulty;
    if (search) {
      filter.question = { $regex: search, $options: 'i' };
    }
    
    const questions = await Question.find(filter)
      .populate('createdBy', 'username')
      .sort({ createdAt: -1 })
      .skip((parseInt(page) - 1) * parseInt(limit))
      .limit(parseInt(limit));
    
    const total = await Question.countDocuments(filter);
    
    res.json({
      success: true,
      data: questions,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        pages: Math.ceil(total / limit)
      }
    });
  } catch (error) {
    next(error);
  }
};

const bulkCreateQuestions = async (req, res, next) => {
  try {
    const { questions } = req.body;
    
    if (!Array.isArray(questions) || questions.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'Questions array is required'
      });
    }
    
    const questionsWithCreator = questions.map(q => ({
      ...q,
      createdBy: req.user._id
    }));
    
    const created = await Question.insertMany(questionsWithCreator);
    
    res.status(201).json({
      success: true,
      message: `${created.length} questions created successfully`,
      data: created
    });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  getDashboardStats,
  getUsers,
  getUserById,
  updateUser,
  deleteUser,
  getAllQuestions,
  bulkCreateQuestions
};
