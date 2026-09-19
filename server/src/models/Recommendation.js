const mongoose = require('mongoose');

const recommendationSchema = new mongoose.Schema({
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
  title: {
    type: String,
    required: true,
  },
  text: {
    type: String,
    required: true,
  },
  actionType: {
    type: String,
    enum: ['review_material', 'take_quiz', 'tutor_session', 'reinforce_concept'],
    default: 'review_material',
  },
  targetConcept: String,
  materialId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Material',
  },
  isCompleted: {
    type: Boolean,
    default: false,
  },
  createdAt: {
    type: Date,
    default: Date.now,
  },
});

module.exports = mongoose.model('Recommendation', recommendationSchema);
