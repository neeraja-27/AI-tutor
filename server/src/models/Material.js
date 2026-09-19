const mongoose = require('mongoose');

const materialSchema = new mongoose.Schema({
  projectId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Project',
    required: true,
    index: true,
  },
  filename: {
    type: String,
    required: true,
  },
  originalName: {
    type: String,
    required: true,
  },
  filePath: {
    type: String,
    required: true,
  },
  fileSize: {
    type: Number,
  },
  mimeType: {
    type: String,
    default: 'application/pdf',
  },
  status: {
    type: String,
    enum: ['queued', 'processing', 'ready', 'failed'],
    default: 'queued',
  },
  errorMessage: {
    type: String,
  },
  chunkCount: {
    type: Number,
    default: 0,
  },
  uploadedAt: {
    type: Date,
    default: Date.now,
  },
});

module.exports = mongoose.model('Material', materialSchema);
