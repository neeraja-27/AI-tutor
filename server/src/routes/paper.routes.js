const express = require('express');
const fs = require('fs');
const path = require('path');
const Project = require('../models/Project');
const QuestionPaper = require('../models/QuestionPaper');
const { protect } = require('../middleware/auth');
const ragService = require('../services/ragService');

const router = express.Router();

const papersDir = path.join(__dirname, '../../data/papers');
if (!fs.existsSync(papersDir)) {
  fs.mkdirSync(papersDir, { recursive: true });
}

function clampInt(value, min, max, fallback) {
  const parsed = Number.parseInt(value, 10);
  if (Number.isNaN(parsed)) return fallback;
  return Math.max(min, Math.min(max, parsed));
}

function safeFilename(title) {
  const cleaned = String(title || 'question-paper')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 60);
  return cleaned || 'question-paper';
}

function toClient(paper) {
  const doc = paper.toObject ? paper.toObject() : paper;
  return {
    _id: doc._id,
    projectId: doc.projectId,
    title: doc.title,
    subject: doc.subject || '',
    topic: doc.topic || '',
    durationMinutes: doc.durationMinutes,
    totalMarks: doc.totalMarks,
    questionCount: doc.questionCount,
    difficulty: doc.difficulty,
    includeAnswerKey: doc.includeAnswerKey,
    instructions: doc.instructions || [],
    sections: doc.sections || [],
    sources: doc.sources || [],
    groundedIn: doc.groundedIn || '',
    model: doc.model || '',
    createdAt: doc.createdAt,
  };
}

async function ownedProject(projectId, userId) {
  return Project.findOne({ _id: projectId, ownerId: userId });
}

// @route   GET /api/papers/projects/:projectId
// @desc    List question papers generated for a project
// @access  Private
router.get('/projects/:projectId', protect, async (req, res) => {
  try {
    const project = await ownedProject(req.params.projectId, req.user._id);
    if (!project) {
      return res.status(404).json({ message: 'Project not found or unauthorized' });
    }

    const papers = await QuestionPaper.find({
      projectId: project._id,
      userId: req.user._id,
    }).sort({ createdAt: -1 });

    res.json(papers.map(toClient));
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// @route   POST /api/papers/projects/:projectId/generate
// @desc    Generate questions from project materials and store the Python-built PDF
// @access  Private
router.post('/projects/:projectId/generate', protect, async (req, res) => {
  try {
    const project = await ownedProject(req.params.projectId, req.user._id);
    if (!project) {
      return res.status(404).json({ message: 'Project not found or unauthorized' });
    }

    const difficulty = ['easy', 'medium', 'hard', 'mixed'].includes(req.body.difficulty)
      ? req.body.difficulty
      : 'mixed';
    const mcqCount = clampInt(req.body.mcqCount, 0, 12, 5);
    const shortCount = clampInt(req.body.shortCount, 0, 6, 3);
    const longCount = clampInt(req.body.longCount, 0, 4, 2);
    if (mcqCount + shortCount + longCount < 1) {
      return res.status(400).json({ message: 'Choose at least one question to generate.' });
    }

    const title = String(req.body.title || `${project.name} Question Paper`).trim().slice(0, 140);
    const subject = String(req.body.subject || '').trim().slice(0, 80);
    const topic = String(req.body.topic || '').trim().slice(0, 200);
    const durationMinutes = clampInt(req.body.durationMinutes, 15, 180, 90);
    const includeAnswerKey = Boolean(req.body.includeAnswerKey);

    const generated = await ragService.generateQuestionPaper({
      projectId: project._id.toString(),
      title,
      subject,
      topic,
      durationMinutes,
      mcqCount,
      shortCount,
      longCount,
      difficulty,
      includeAnswerKey,
    });

    const pdfBuffer = Buffer.from(generated.pdf_base64 || '', 'base64');
    if (!pdfBuffer.length || pdfBuffer.slice(0, 4).toString() !== '%PDF') {
      return res.status(502).json({ message: 'The question paper PDF could not be built.' });
    }

    const storedName = `${Date.now()}-${safeFilename(title)}.pdf`;
    const pdfPath = path.join(papersDir, storedName);
    fs.writeFileSync(pdfPath, pdfBuffer);

    const sections = (generated.sections || []).map((section) => ({
      id: section.id,
      title: section.title,
      type: section.type,
      marksEach: section.marks_each,
      questions: section.questions || [],
    }));

    const paper = await QuestionPaper.create({
      projectId: project._id,
      userId: req.user._id,
      title: generated.title || title,
      subject: generated.subject || subject,
      topic: generated.topic || topic,
      durationMinutes: generated.duration_minutes || durationMinutes,
      totalMarks: generated.total_marks || 0,
      questionCount: generated.question_count || 0,
      difficulty,
      includeAnswerKey,
      instructions: generated.instructions || [],
      sections,
      sources: generated.sources || [],
      groundedIn: generated.grounded_in || '',
      pdfPath,
      pdfFilename: storedName,
      model: generated.model || '',
    });

    res.status(201).json(toClient(paper));
  } catch (error) {
    const status = error.statusCode || 500;
    res.status(status).json({ message: error.message });
  }
});

// @route   GET /api/papers/:paperId/pdf
// @desc    Download the generated question paper PDF
// @access  Private
router.get('/:paperId/pdf', protect, async (req, res) => {
  try {
    const paper = await QuestionPaper.findOne({
      _id: req.params.paperId,
      userId: req.user._id,
    });
    if (!paper || !paper.pdfPath || !fs.existsSync(paper.pdfPath)) {
      return res.status(404).json({ message: 'Question paper PDF not found' });
    }

    const downloadName = `${safeFilename(paper.title)}.pdf`;
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="${downloadName}"`);
    res.sendFile(path.resolve(paper.pdfPath));
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// @route   DELETE /api/papers/:paperId
// @desc    Delete a generated question paper and its PDF
// @access  Private
router.delete('/:paperId', protect, async (req, res) => {
  try {
    const paper = await QuestionPaper.findOneAndDelete({
      _id: req.params.paperId,
      userId: req.user._id,
    });
    if (!paper) {
      return res.status(404).json({ message: 'Question paper not found' });
    }
    if (paper.pdfPath && fs.existsSync(paper.pdfPath)) {
      fs.unlinkSync(paper.pdfPath);
    }
    res.json({ message: 'Question paper deleted' });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

module.exports = router;
