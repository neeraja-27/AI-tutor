const mongoose = require('mongoose');

const aiTraceSchema = new mongoose.Schema({
  projectId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Project',
    index: true,
  },
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    index: true,
  },
  conversationId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Conversation',
  },
  feature: {
    type: String,
    enum: ['tutor_rag', 'quiz_generation', 'answer_evaluation', 'recommendation_generation'],
    default: 'tutor_rag',
  },
  query: {
    type: String,
    required: true,
  },
  retrievedCount: {
    type: Number,
    default: 0,
  },
  model: {
    type: String,
    required: true,
  },
  tokensUsed: {
    type: Number,
    default: 0,
  },
  latencyMs: {
    type: Number,
    required: true,
  },
  success: {
    type: Boolean,
    default: true,
  },
  errorMessage: {
    type: String,
  },
  timestamp: {
    type: Date,
    default: Date.now,
  },
});

module.exports = mongoose.model('AITrace', aiTraceSchema);
