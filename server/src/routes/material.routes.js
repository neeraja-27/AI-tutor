const express = require('express');
const router = express.Router();
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const Material = require('../models/Material');
const Job = require('../models/Job');
const Project = require('../models/Project');
const { protect } = require('../middleware/auth');
const ragService = require('../services/ragService');

// Configure Multer for PDF uploads
const uploadDir = path.join(__dirname, '../../uploads');
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}

const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, uploadDir);
  },
  filename: function (req, file, cb) {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1e9);
    cb(null, uniqueSuffix + '-' + file.originalname);
  },
});

const fileFilter = (req, file, cb) => {
  if (file.mimetype === 'application/pdf') {
    cb(null, true);
  } else {
    cb(new Error('Only PDF files are supported'), false);
  }
};

const upload = multer({
  storage: storage,
  fileFilter: fileFilter,
  limits: { fileSize: 50 * 1024 * 1024 }, // 50MB max
});

// @route   POST /api/materials/projects/:projectId
// @desc    Upload a PDF learning material to a project
// @access  Private
router.post('/projects/:projectId', protect, upload.single('file'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ message: 'No PDF file uploaded' });
    }

    const project = await Project.findOne({ _id: req.params.projectId, ownerId: req.user._id });
    if (!project) {
      return res.status(404).json({ message: 'Project not found or unauthorized' });
    }

    // 1. Create Material Record
    const material = await Material.create({
      projectId: project._id,
      filename: req.file.filename,
      originalName: req.file.originalname,
      filePath: path.resolve(req.file.path),
      fileSize: req.file.size,
      status: 'queued',
    });

    // 2. Create Background Ingestion Job
    const job = await Job.create({
      projectId: project._id,
      materialId: material._id,
      type: 'ingest',
      status: 'queued',
    });

    res.status(202).json({
      message: 'File uploaded successfully and queued for background RAG processing',
      material,
      jobId: job._id,
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// @route   GET /api/materials/:materialId
// @desc    Get status of uploaded material
// @access  Private
router.get('/:materialId', protect, async (req, res) => {
  try {
    const material = await Material.findById(req.params.materialId);
    if (!material) {
      return res.status(404).json({ message: 'Material not found' });
    }
    res.json(material);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// @route   DELETE /api/materials/:materialId
// @desc    Delete material and its vector embeddings
// @access  Private
router.delete('/:materialId', protect, async (req, res) => {
  try {
    const material = await Material.findById(req.params.materialId);
    if (!material) {
      return res.status(404).json({ message: 'Material not found' });
    }

    // Delete vectors in Python RAG service
    await ragService.deleteMaterialVectors({
      projectId: material.projectId,
      materialId: material._id,
    });

    // Remove file if exists
    if (fs.existsSync(material.filePath)) {
      fs.unlinkSync(material.filePath);
    }

    await Material.findByIdAndDelete(material._id);
    res.json({ message: 'Material and corresponding vectors deleted successfully' });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

module.exports = router;
