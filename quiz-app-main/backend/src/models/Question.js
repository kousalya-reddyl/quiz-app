const mongoose = require('mongoose');

const CATEGORIES = ['Science', 'History', 'Geography', 'Sports', 'Entertainment', 'Technology', 'General Knowledge'];
const DIFFICULTIES = ['easy', 'medium', 'hard'];

const questionSchema = new mongoose.Schema({
  question: {
    type: String,
    required: [true, 'Question text is required'],
    trim: true,
    minlength: [10, 'Question must be at least 10 characters'],
    maxlength: [500, 'Question cannot exceed 500 characters']
  },
  options: {
    type: [String],
    required: [true, 'Options are required'],
    validate: {
      validator: function(v) {
        return v.length >= 2 && v.length <= 6;
      },
      message: 'Questions must have between 2 and 6 options'
    }
  },
  correctAnswer: {
    type: String,
    required: [true, 'Correct answer is required']
  },
  category: {
    type: String,
    enum: CATEGORIES,
    default: 'General Knowledge'
  },
  difficulty: {
    type: String,
    enum: DIFFICULTIES,
    default: 'medium'
  },
  topic: {
    type: String,
    trim: true,
    maxlength: 60,
    default: 'General'
  },
  timeLimit: {
    type: Number,
    default: 30,
    min: [10, 'Time limit must be at least 10 seconds'],
    max: [120, 'Time limit cannot exceed 120 seconds']
  },
  points: {
    type: Number,
    default: 10,
    min: [1, 'Points must be at least 1'],
    max: [100, 'Points cannot exceed 100']
  },
  explanation: {
    type: String,
    maxlength: 500,
    default: ''
  },
  createdBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  },
  isActive: {
    type: Boolean,
    default: true
  },
  timesAnswered: {
    type: Number,
    default: 0
  },
  timesCorrect: {
    type: Number,
    default: 0
  }
}, {
  timestamps: true
});

questionSchema.index({ category: 1, difficulty: 1, isActive: 1 });
questionSchema.index({ topic: 1, isActive: 1 });
questionSchema.index({ createdBy: 1 });

questionSchema.methods.calculateSuccessRate = function() {
  if (this.timesAnswered === 0) return 0;
  return Math.round((this.timesCorrect / this.timesAnswered) * 100);
};

module.exports = mongoose.model('Question', questionSchema);
module.exports.CATEGORIES = CATEGORIES;
module.exports.DIFFICULTIES = DIFFICULTIES;
