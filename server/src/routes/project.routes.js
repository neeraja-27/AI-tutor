const express = require('express');
const router = express.Router();
const Project = require('../models/Project');
const Material = require('../models/Material');
const Mastery = require('../models/Mastery');
const Recommendation = require('../models/Recommendation');
const { protect } = require('../middleware/auth');

// @route   GET /api/projects/:projectId
// @desc    Get project dashboard details
// @access  Private
router.get('/:projectId', protect, async (req, res) => {
  try {
    const project = await Project.findOne({ _id: req.params.projectId, ownerId: req.user._id });
    if (!project) {
      return res.status(404).json({ message: 'Project not found or unauthorized' });
    }

    // Fetch related materials, mastery levels, recommendations
    const materials = await Material.find({ projectId: project._id }).sort({ uploadedAt: -1 });
    const mastery = await Mastery.find({ projectId: project._id, userId: req.user._id });
    const recommendations = await Recommendation.find({
      projectId: project._id,
      userId: req.user._id,
      isCompleted: false,
    }).sort({ createdAt: -1 });

    res.json({
      project,
      materials,
      mastery,
      recommendations,
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// @route   PUT /api/projects/:projectId
// @desc    Update project goal / details
// @access  Private
router.put('/:projectId', protect, async (req, res) => {
  try {
    const { name, description, learningGoal } = req.body;
    const project = await Project.findOneAndUpdate(
      { _id: req.params.projectId, ownerId: req.user._id },
      { $set: { name, description, learningGoal } },
      { new: true }
    );

    if (!project) {
      return res.status(404).json({ message: 'Project not found or unauthorized' });
    }

    res.json(project);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

module.exports = router;
