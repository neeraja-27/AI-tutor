const mongoose = require('mongoose');

const masterySchema = new mongoose.Schema({
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
  },
  concept: {
    type: String,
    required: true,
  },
  level: {
    type: Number, // 0 to 100%
    required: true,
    default: 0,
  },
  status: {
    type: String,
    enum: ['improving', 'stable', 'requiring_attention'],
    default: 'requiring_attention',
  },
  history: [
    {
      level: Number,
      recordedAt: {
        type: Date,
        default: Date.now,
      },
      source: String, // 'quiz', 'tutor', 'assessment'
    },
  ],
  updatedAt: {
    type: Date,
    default: Date.now,
  },
});

masterySchema.index({ projectId: 1, userId: 1, concept: 1 }, { unique: true });

module.exports = mongoose.model('Mastery', masterySchema);
