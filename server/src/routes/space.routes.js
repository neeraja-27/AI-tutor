const express = require('express');
const router = express.Router();
const Space = require('../models/Space');
const Project = require('../models/Project');
const { protect } = require('../middleware/auth');

// @route   GET /api/spaces
// @desc    Get all spaces for logged-in user
// @access  Private
router.get('/', protect, async (req, res) => {
  try {
    const spaces = await Space.find({ ownerId: req.user._id }).sort({ createdAt: -1 });
    res.json(spaces);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// @route   POST /api/spaces
// @desc    Create a new space
// @access  Private
router.post('/', protect, async (req, res) => {
  try {
    const { name, description } = req.body;
    if (!name) {
      return res.status(400).json({ message: 'Space name is required' });
    }

    const space = await Space.create({
      name,
      description: description || '',
      ownerId: req.user._id,
    });

    res.status(201).json(space);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// @route   GET /api/spaces/:spaceId/projects
// @desc    Get all projects under a space
// @access  Private
router.get('/:spaceId/projects', protect, async (req, res) => {
  try {
    const space = await Space.findOne({ _id: req.params.spaceId, ownerId: req.user._id });
    if (!space) {
      return res.status(404).json({ message: 'Space not found' });
    }

    const projects = await Project.find({ spaceId: req.params.spaceId, ownerId: req.user._id }).sort({
      createdAt: -1,
    });
    res.json(projects);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// @route   POST /api/spaces/:spaceId/projects
// @desc    Create a project within a space
// @access  Private
router.post('/:spaceId/projects', protect, async (req, res) => {
  try {
    const { name, description, learningGoal } = req.body;
    if (!name) {
      return res.status(400).json({ message: 'Project name is required' });
    }

    const space = await Space.findOne({ _id: req.params.spaceId, ownerId: req.user._id });
    if (!space) {
      return res.status(404).json({ message: 'Space not found' });
    }

    const project = await Project.create({
      name,
      description: description || '',
      learningGoal: learningGoal || '',
      spaceId: space._id,
      ownerId: req.user._id,
    });

    res.status(201).json(project);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// @route   DELETE /api/spaces/:spaceId
// @desc    Delete a space and its projects
// @access  Private
router.delete('/:spaceId', protect, async (req, res) => {
  try {
    const space = await Space.findOneAndDelete({ _id: req.params.spaceId, ownerId: req.user._id });
    if (!space) {
      return res.status(404).json({ message: 'Space not found' });
    }
    await Project.deleteMany({ spaceId: req.params.spaceId });
    res.json({ message: 'Space and associated projects removed' });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

module.exports = router;
