const express = require('express');
const router = express.Router();
const Mastery = require('../models/Mastery');
const Recommendation = require('../models/Recommendation');
const { protect } = require('../middleware/auth');

// @route   GET /api/mastery/projects/:projectId
// @desc    Get concept mastery levels and recommendations
// @access  Private
router.get('/projects/:projectId', protect, async (req, res) => {
  try {
    const masteryList = await Mastery.find({
      projectId: req.params.projectId,
      userId: req.user._id,
    }).sort({ level: 1 });

    const recommendations = await Recommendation.find({
      projectId: req.params.projectId,
      userId: req.user._id,
    }).sort({ createdAt: -1 });

    res.json({
      mastery: masteryList,
      recommendations,
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

module.exports = router;
