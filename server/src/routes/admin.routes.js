const express = require('express');
const router = express.Router();
const User = require('../models/User');
const Space = require('../models/Space');
const Project = require('../models/Project');
const Material = require('../models/Material');
const Job = require('../models/Job');
const AITrace = require('../models/AITrace');
const { protect, requireAdmin } = require('../middleware/auth');

// @route   GET /api/admin/overview
// @desc    Get system-wide overview stats
// @access  Private (Admin)
router.get('/overview', protect, requireAdmin, async (req, res) => {
  try {
    const totalUsers = await User.countDocuments();
    const totalSpaces = await Space.countDocuments();
    const totalProjects = await Project.countDocuments();
    const totalMaterials = await Material.countDocuments();
    const totalTraces = await AITrace.countDocuments();
    const failedTraces = await AITrace.countDocuments({ success: false });
    const pendingJobs = await Job.countDocuments({ status: { $in: ['queued', 'processing'] } });

    const recentTraces = await AITrace.find()
      .sort({ timestamp: -1 })
      .limit(20)
      .populate('userId', 'name email')
      .populate('projectId', 'name');

    res.json({
      metrics: {
        totalUsers,
        totalSpaces,
        totalProjects,
        totalMaterials,
        totalTraces,
        failedTraces,
        pendingJobs,
      },
      recentTraces,
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// @route   GET /api/admin/users
// @desc    List all users
// @access  Private (Admin)
router.get('/users', protect, requireAdmin, async (req, res) => {
  try {
    const users = await User.find().select('-passwordHash').sort({ createdAt: -1 });
    res.json(users);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

module.exports = router;
