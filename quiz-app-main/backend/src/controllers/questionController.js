const { Question } = require('../models');
const config = require('../config');

const getQuestions = async (req, res, next) => {
  try {
    const { category, difficulty, count = config.QUESTIONS_PER_QUIZ } = req.query;
    
    const filter = { isActive: true };
    
    if (category && category !== 'all') filter.category = category;
    if (difficulty && difficulty !== 'all') filter.difficulty = difficulty;
    
    const size = Math.max(1, Math.min(50, parseInt(count, 10) || config.QUESTIONS_PER_QUIZ));

    const questions = await Question.aggregate([
      { $match: filter },
      { $sample: { size } },
      {
        $project: {
          correctAnswer: 0,
          explanation: 0,
          timesAnswered: 0,
          timesCorrect: 0,
          createdBy: 0,
          isActive: 0
        }
      }
    ]);
    
    if (questions.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'No questions found. Please try different filters or add questions.'
      });
    }
    
    res.json({
      success: true,
      data: questions,
      count: questions.length
    });
  } catch (error) {
    next(error);
  }
};

const getQuestionById = async (req, res, next) => {
  try {
    const question = await Question.findById(req.params.id).select('-correctAnswer -explanation');
    
    if (!question) {
      return res.status(404).json({
        success: false,
        message: 'Question not found'
      });
    }
    
    res.json({
      success: true,
      data: question
    });
  } catch (error) {
    next(error);
  }
};

const createQuestion = async (req, res, next) => {
  try {
    const { question, options, correctAnswer, category, difficulty, timeLimit, points, explanation, topic } = req.body;
    
    const questionData = {
      question,
      options,
      correctAnswer,
      category: category || 'General Knowledge',
      difficulty: difficulty || 'medium',
      topic: topic || 'General',
      timeLimit: timeLimit || 30,
      points: points || 10,
      explanation: explanation || '',
      createdBy: req.user._id
    };
    
    const newQuestion = await Question.create(questionData);
    
    res.status(201).json({
      success: true,
      message: 'Question created successfully',
      data: newQuestion
    });
  } catch (error) {
    next(error);
  }
};

const updateQuestion = async (req, res, next) => {
  try {
    const question = await Question.findById(req.params.id);
    
    if (!question) {
      return res.status(404).json({
        success: false,
        message: 'Question not found'
      });
    }
    
    if (req.user.role !== 'admin' && question.createdBy.toString() !== req.user._id.toString()) {
      return res.status(403).json({
        success: false,
        message: 'Not authorized to update this question'
      });
    }
    
    const { question: q, options, correctAnswer, category, difficulty, timeLimit, points, explanation, isActive, topic } = req.body;
    
    if (q) question.question = q;
    if (options) question.options = options;
    if (correctAnswer) question.correctAnswer = correctAnswer;
    if (category) question.category = category;
    if (difficulty) question.difficulty = difficulty;
    if (topic) question.topic = topic;
    if (timeLimit) question.timeLimit = timeLimit;
    if (points) question.points = points;
    if (explanation !== undefined) question.explanation = explanation;
    if (isActive !== undefined && req.user.role === 'admin') question.isActive = isActive;
    
    await question.save();
    
    res.json({
      success: true,
      message: 'Question updated successfully',
      data: question
    });
  } catch (error) {
    next(error);
  }
};

const deleteQuestion = async (req, res, next) => {
  try {
    const question = await Question.findById(req.params.id);
    
    if (!question) {
      return res.status(404).json({
        success: false,
        message: 'Question not found'
      });
    }
    
    if (req.user.role !== 'admin' && question.createdBy.toString() !== req.user._id.toString()) {
      return res.status(403).json({
        success: false,
        message: 'Not authorized to delete this question'
      });
    }
    
    await question.deleteOne();
    
    res.json({
      success: true,
      message: 'Question deleted successfully'
    });
  } catch (error) {
    next(error);
  }
};

const getCategories = async (_req, res) => {
  try {
    let categories = await Question.distinct('category', { isActive: true });
    
    // Always return valid JSON with default categories if none exist
    if (!categories || categories.length === 0) {
      categories = ['Science', 'History', 'Geography', 'Sports', 'Entertainment', 'Technology', 'General Knowledge'];
    }
    
    res.status(200).json({
      success: true,
      data: categories
    });
  } catch {
    // Return fallback categories on error
    res.status(200).json({
      success: true,
      data: ['Science', 'History', 'Geography', 'Sports', 'Entertainment', 'Technology', 'General Knowledge']
    });
  }
};


const getQuestionStats = async (_req, res, next) => {
  try {
    const stats = await Question.aggregate([
      { $match: { isActive: true } },
      {
        $group: {
          _id: { category: '$category', difficulty: '$difficulty' },
          count: { $sum: 1 },
          avgTimeLimit: { $avg: '$timeLimit' },
          avgPoints: { $avg: '$points' }
        }
      },
      { $sort: { '_id.category': 1, '_id.difficulty': 1 } }
    ]);
    
    const totalQuestions = await Question.countDocuments({ isActive: true });
    
    res.json({
      success: true,
      data: {
        total: totalQuestions,
        breakdown: stats
      }
    });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  getQuestions,
  getQuestionById,
  createQuestion,
  updateQuestion,
  deleteQuestion,
  getCategories,
  getQuestionStats
};
