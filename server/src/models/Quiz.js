const mongoose = require('mongoose');

const questionSchema = new mongoose.Schema({
  question: {
    type: String,
    required: true,
  },
  type: {
    type: String,
    enum: ['mcq', 'open_ended'],
    default: 'mcq',
  },
  choices: [String],
  correctAnswer: mongoose.Schema.Types.Mixed, // index or text
  concept: String,
  difficulty: {
    type: String,
    enum: ['easy', 'medium', 'hard'],
    default: 'medium',
  },
  explanation: String,
  rubric: {
    keyConcepts: [String],
    guidelines: String,
    sampleAnswer: String,
  },
  adaptiveRationale: String,
});

const quizSchema = new mongoose.Schema({
  projectId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Project',
    required: true,
    index: true,
  },
  title: {
    type: String,
    required: true,
  },
  targetConcepts: [String],
  questions: [questionSchema],
  createdAt: {
    type: Date,
    default: Date.now,
  },
});

const quizAttemptSchema = new mongoose.Schema({
  quizId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Quiz',
    default: null,
  },
  projectId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Project',
    required: true,
  },
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
  },
  answers: [
    {
      questionIndex: Number,
      questionText: String,
      questionType: {
        type: String,
        default: 'mcq',
      },
      concept: String,
      difficulty: String,
      userAnswer: mongoose.Schema.Types.Mixed,
      isCorrect: Boolean,
      score: {
        type: Number,
        default: 0,
      },
      evaluationFeedback: String,
      detailedEvaluation: {
        understanding: String,
        accuracy: String,
        relevance: String,
        keyConceptsCovered: [String],
        missingConcepts: [String],
        reasoning: String,
      },
    },
  ],
  score: {
    type: Number,
    required: true,
  },
  totalQuestions: {
    type: Number,
    required: true,
  },
  mode: {
    type: String,
    enum: ['standard', 'adaptive'],
    default: 'standard',
  },
  conceptDeltas: [
    {
      concept: String,
      beforeLevel: Number,
      afterLevel: Number,
      change: Number,
    },
  ],
  takenAt: {
    type: Date,
    default: Date.now,
  },
});

const adaptiveSessionSchema = new mongoose.Schema({
  projectId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Project',
    required: true,
    index: true,
  },
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    index: true,
  },
  totalQuestionsTarget: {
    type: Number,
    default: 5,
  },
  currentQuestionIndex: {
    type: Number,
    default: 0,
  },
  status: {
    type: String,
    enum: ['active', 'completed', 'abandoned'],
    default: 'active',
  },
  focus: {
    type: String,
    default: 'auto',
  },
  questions: [questionSchema],
  answers: [
    {
      questionIndex: Number,
      userAnswer: mongoose.Schema.Types.Mixed,
      isCorrect: Boolean,
      score: Number,
      evaluationFeedback: String,
      detailedEvaluation: {
        understanding: String,
        accuracy: String,
        relevance: String,
        keyConceptsCovered: [String],
        missingConcepts: [String],
        reasoning: String,
      },
      answeredAt: {
        type: Date,
        default: Date.now,
      },
    },
  ],
  selectedConcepts: [String],
  mistakes: [
    {
      concept: String,
      questionText: String,
      userAnswer: mongoose.Schema.Types.Mixed,
      feedback: String,
      timestamp: {
        type: Date,
        default: Date.now,
      },
    },
  ],
  performance: {
    totalAnswered: { type: Number, default: 0 },
    correctCount: { type: Number, default: 0 },
    averageScore: { type: Number, default: 0 },
    streak: { type: Number, default: 0 },
  },
  conceptDeltas: [
    {
      concept: String,
      beforeLevel: Number,
      afterLevel: Number,
      change: Number,
    },
  ],
  projectContext: {
    type: mongoose.Schema.Types.Mixed,
    default: null,
  },
  createdAt: {
    type: Date,
    default: Date.now,
  },
  updatedAt: {
    type: Date,
    default: Date.now,
  },
});

const Quiz = mongoose.model('Quiz', quizSchema);
const QuizAttempt = mongoose.model('QuizAttempt', quizAttemptSchema);
const AdaptiveSession = mongoose.model('AdaptiveSession', adaptiveSessionSchema);

module.exports = { Quiz, QuizAttempt, AdaptiveSession };
