const express = require('express');
const router = express.Router();
const { QuizAttempt } = require('../models/Quiz');
const Mastery = require('../models/Mastery');
const Material = require('../models/Material');
const AITrace = require('../models/AITrace');
const { protect } = require('../middleware/auth');

// @route   GET /api/analytics/projects/:projectId
// @desc    Get project analytics (quiz performance, mastery breakdown, AI stats)
// @access  Private
router.get('/projects/:projectId', protect, async (req, res) => {
  try {
    const attempts = await QuizAttempt.find({
      projectId: req.params.projectId,
      userId: req.user._id,
    }).sort({ takenAt: 1 });

    const mastery = await Mastery.find({
      projectId: req.params.projectId,
      userId: req.user._id,
    });

    const materialsCount = await Material.countDocuments({ projectId: req.params.projectId });

    const aiTraces = await AITrace.find({
      projectId: req.params.projectId,
      userId: req.user._id,
    }).sort({ timestamp: -1 }).limit(50);

    const totalTokens = aiTraces.reduce((sum, t) => sum + (t.tokensUsed || 0), 0);
    const avgLatency = aiTraces.length
      ? Math.round(aiTraces.reduce((sum, t) => sum + (t.latencyMs || 0), 0) / aiTraces.length)
      : 0;

    res.json({
      quizAttemptsCount: attempts.length,
      recentAttempts: attempts,
      masterySummary: mastery,
      materialsCount,
      aiStats: {
        totalQueries: aiTraces.length,
        totalTokens,
        avgLatencyMs: avgLatency,
      },
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

module.exports = router;
