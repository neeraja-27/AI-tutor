const mongoose = require('mongoose');

const questionPaperSchema = new mongoose.Schema({
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
  title: {
    type: String,
    required: true,
    trim: true,
  },
  subject: {
    type: String,
    default: '',
  },
  topic: {
    type: String,
    default: '',
  },
  durationMinutes: {
    type: Number,
    default: 90,
  },
  totalMarks: {
    type: Number,
    default: 0,
  },
  questionCount: {
    type: Number,
    default: 0,
  },
  difficulty: {
    type: String,
    enum: ['easy', 'medium', 'hard', 'mixed'],
    default: 'mixed',
  },
  includeAnswerKey: {
    type: Boolean,
    default: false,
  },
  instructions: [String],
  sections: {
    type: mongoose.Schema.Types.Mixed,
    default: [],
  },
  sources: {
    type: [
      {
        source: String,
        page: mongoose.Schema.Types.Mixed,
      },
    ],
    default: [],
  },
  groundedIn: {
    type: String,
    default: '',
  },
  pdfPath: String,
  pdfFilename: String,
  model: String,
  createdAt: {
    type: Date,
    default: Date.now,
  },
});

module.exports = mongoose.model('QuestionPaper', questionPaperSchema);
