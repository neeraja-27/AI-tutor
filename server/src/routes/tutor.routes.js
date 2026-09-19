const express = require('express');
const router = express.Router();
const Conversation = require('../models/Conversation');
const Message = require('../models/Message');
const Project = require('../models/Project');
const AITrace = require('../models/AITrace');
const { protect } = require('../middleware/auth');
const ragService = require('../services/ragService');

// @route   GET /api/tutor/projects/:projectId/conversations
// @desc    Get active or create new conversation for project
// @access  Private
router.get('/projects/:projectId/conversations', protect, async (req, res) => {
  try {
    let conversation = await Conversation.findOne({
      projectId: req.params.projectId,
      userId: req.user._id,
      status: 'open',
    }).sort({ startedAt: -1 });

    if (!conversation) {
      conversation = await Conversation.create({
        projectId: req.params.projectId,
        userId: req.user._id,
        title: 'Study Session',
      });
    }

    const messages = await Message.find({ conversationId: conversation._id }).sort({ timestamp: 1 });

    res.json({ conversation, messages });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// @route   POST /api/tutor/projects/:projectId/chat
// @desc    Send a message to AI Tutor and receive grounded citation response
// @access  Private
router.post('/projects/:projectId/chat', protect, async (req, res) => {
  const { question, conversationId, topK = 5, minScore = 0.2 } = req.body;

  if (!question) {
    return res.status(400).json({ message: 'Question is required' });
  }

  try {
    const project = await Project.findOne({ _id: req.params.projectId, ownerId: req.user._id });
    if (!project) {
      return res.status(404).json({ message: 'Project not found or unauthorized' });
    }

    // 1. Get or create conversation
    let convId = conversationId;
    if (!convId) {
      const conv = await Conversation.create({
        projectId: project._id,
        userId: req.user._id,
        title: question.slice(0, 30) + '...',
      });
      convId = conv._id;
    }

    // 2. Save user message
    const userMsg = await Message.create({
      conversationId: convId,
      projectId: project._id,
      sender: 'user',
      text: question,
    });

    // 3. Call Python RAG Service
    let ragResponse;
    try {
      ragResponse = await ragService.queryTutor({
        question,
        projectId: project._id,
        topK,
        minScore,
      });
    } catch (ragErr) {
      // Log failed AI Trace
      await AITrace.create({
        projectId: project._id,
        userId: req.user._id,
        conversationId: convId,
        feature: 'tutor_rag',
        query: question,
        model: 'groq-llama',
        latencyMs: 0,
        success: false,
        errorMessage: ragErr.message,
      });
      throw ragErr;
    }

    // 4. Save AI Response message
    const aiMsg = await Message.create({
      conversationId: convId,
      projectId: project._id,
      sender: 'ai',
      text: ragResponse.answer,
      citations: ragResponse.sources || [],
      evidenceFound: ragResponse.evidence_found !== false,
    });

    // 5. Log AI Observability Trace
    await AITrace.create({
      projectId: project._id,
      userId: req.user._id,
      conversationId: convId,
      feature: 'tutor_rag',
      query: question,
      retrievedCount: ragResponse.sources ? ragResponse.sources.length : 0,
      model: ragResponse.model || 'groq',
      tokensUsed: ragResponse.tokens_used || 0,
      latencyMs: ragResponse.latency_ms || 0,
      success: true,
    });

    res.json({
      userMessage: userMsg,
      aiMessage: aiMsg,
      citations: ragResponse.citations || [],
      confidence: ragResponse.confidence || 0,
      evidenceFound: ragResponse.evidence_found !== false,
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

module.exports = router;
