const mongoose = require('mongoose');

const jobSchema = new mongoose.Schema({
  projectId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Project',
    required: true,
  },
  materialId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Material',
  },
  type: {
    type: String,
    enum: ['ingest', 'embed', 'quiz_generate', 'mastery_calc'],
    required: true,
  },
  status: {
    type: String,
    enum: ['queued', 'processing', 'done', 'error'],
    default: 'queued',
    index: true,
  },
  attempts: {
    type: Number,
    default: 0,
  },
  maxAttempts: {
    type: Number,
    default: 3,
  },
  error: {
    type: String,
  },
  startedAt: {
    type: Date,
  },
  finishedAt: {
    type: Date,
  },
  createdAt: {
    type: Date,
    default: Date.now,
  },
});

module.exports = mongoose.model('Job', jobSchema);
