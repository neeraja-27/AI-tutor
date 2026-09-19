const express = require('express');
const cors = require('cors');
const dotenv = require('dotenv');
const connectDB = require('./config/db');
const jobWorker = require('./services/jobWorker');
const { notFound, errorHandler } = require('./middleware/errorHandler');

// Load env vars
dotenv.config();

// Connect to MongoDB
connectDB();

// Start background task worker
jobWorker.start();

const app = express();

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Root health route
app.get('/api/health', (req, res) => {
  res.json({
    status: 'healthy',
    service: 'backend-api',
    uptime: process.uptime(),
    timestamp: new Date(),
  });
});

// Mount Routes
app.use('/api/auth', require('./routes/auth.routes'));
app.use('/api/spaces', require('./routes/space.routes'));
app.use('/api/projects', require('./routes/project.routes'));
app.use('/api/materials', require('./routes/material.routes'));
app.use('/api/tutor', require('./routes/tutor.routes'));
app.use('/api/quizzes', require('./routes/quiz.routes'));
app.use('/api/mastery', require('./routes/mastery.routes'));
app.use('/api/analytics', require('./routes/analytics.routes'));
app.use('/api/admin', require('./routes/admin.routes'));

// Error handling middleware
app.use(notFound);
app.use(errorHandler);

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
  console.log(`✓ AI Learning Companion API running on port ${PORT}`);
});
