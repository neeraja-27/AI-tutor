const express = require('express');
const router = express.Router();
const { Quiz, QuizAttempt, AdaptiveSession } = require('../models/Quiz');
const Mastery = require('../models/Mastery');
const Recommendation = require('../models/Recommendation');
const Project = require('../models/Project');
const { protect } = require('../middleware/auth');
const AdaptiveQuizEngine = require('../services/adaptiveQuizEngine');

// ==========================================
// 1. STANDARD QUIZ ROUTES (Existing API)
// ==========================================

// @route   GET /api/quizzes/projects/:projectId
// @desc    Get all quizzes for a project (standard & recent attempts)
// @access  Private
router.get('/projects/:projectId', protect, async (req, res) => {
  try {
    const quizzes = await Quiz.find({ projectId: req.params.projectId }).sort({ createdAt: -1 });
    const attempts = await QuizAttempt.find({
      projectId: req.params.projectId,
      userId: req.user._id,
    }).sort({ takenAt: -1 }).limit(10);

    res.json({
      quizzes,
      recentAttempts: attempts,
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// @route   POST /api/quizzes/projects/:projectId/attempt
// @desc    Submit a standard quiz attempt, score it, and update Concept Mastery
// @access  Private
router.post('/projects/:projectId/attempt', protect, async (req, res) => {
  try {
    const { quizId, answers } = req.body;
    const quiz = await Quiz.findById(quizId);
    if (!quiz) {
      return res.status(404).json({ message: 'Quiz not found' });
    }

    let correctCount = 0;
    const evaluatedAnswers = answers.map((ans, idx) => {
      const q = quiz.questions[idx];
      const isCorrect = q && (q.correctAnswer === ans.userAnswer || String(q.correctAnswer) === String(ans.userAnswer));
      if (isCorrect) correctCount++;
      return {
        questionIndex: idx,
        questionText: q?.question || '',
        questionType: q?.type || 'mcq',
        concept: q?.concept || 'General',
        difficulty: q?.difficulty || 'medium',
        userAnswer: ans.userAnswer,
        isCorrect: Boolean(isCorrect),
        score: isCorrect ? 100 : 0,
        evaluationFeedback: isCorrect ? 'Correct!' : (q?.explanation || 'Incorrect choice.'),
      };
    });

    const scorePercentage = Math.round((correctCount / quiz.questions.length) * 100);

    const attempt = await QuizAttempt.create({
      quizId,
      projectId: req.params.projectId,
      userId: req.user._id,
      answers: evaluatedAnswers,
      score: scorePercentage,
      totalQuestions: quiz.questions.length,
      mode: 'standard',
    });

    // Update Concept Mastery for concepts tested
    if (quiz.targetConcepts && quiz.targetConcepts.length > 0) {
      for (const concept of quiz.targetConcepts) {
        let mastery = await Mastery.findOne({
          projectId: req.params.projectId,
          userId: req.user._id,
          concept,
        });

        if (!mastery) {
          mastery = new Mastery({
            projectId: req.params.projectId,
            userId: req.user._id,
            concept,
            level: scorePercentage,
            status: scorePercentage >= 75 ? 'improving' : 'requiring_attention',
            history: [{ level: scorePercentage, source: 'quiz', recordedAt: new Date() }],
          });
        } else {
          const newLevel = Math.round((mastery.level * 0.6) + (scorePercentage * 0.4));
          mastery.status = newLevel >= 75 ? 'improving' : newLevel >= 50 ? 'stable' : 'requiring_attention';
          mastery.level = newLevel;
          mastery.history.push({ level: newLevel, source: 'quiz', recordedAt: new Date() });
          mastery.updatedAt = new Date();
        }
        await mastery.save();

        if (scorePercentage < 60) {
          await Recommendation.create({
            projectId: req.params.projectId,
            userId: req.user._id,
            title: `Review ${concept}`,
            text: `Your recent quiz score on "${concept}" was ${scorePercentage}%. Review the uploaded study material and ask the AI Tutor for clarification.`,
            actionType: 'review_material',
            targetConcept: concept,
          });
        }
      }
    }

    res.json({
      attempt,
      score: scorePercentage,
      correctCount,
      totalQuestions: quiz.questions.length,
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// ==========================================
// 2. ADAPTIVE QUIZ & ASSESSMENT ENDPOINTS
// ==========================================

// @route   POST /api/quizzes/projects/:projectId/adaptive/start
// @desc    Initialize a dynamic adaptive quiz session based on learning state
// @access  Private
router.post('/projects/:projectId/adaptive/start', protect, async (req, res) => {
  try {
    const { projectId } = req.params;
    const { totalQuestions = 5, focus = 'auto' } = req.body;

    const project = await Project.findOne({ _id: projectId, ownerId: req.user._id });
    if (!project) {
      return res.status(404).json({ message: 'Project not found or unauthorized' });
    }

    // 1. Understand Current Learning State
    const learningState = await AdaptiveQuizEngine.understandCurrentLearningState(projectId, req.user._id);

    // 2. Multi-factor Selection of First Concept & Difficulty
    const selection = AdaptiveQuizEngine.selectConceptAndDifficulty(learningState, {
      questions: [],
      answers: [],
      mistakes: [],
      currentQuestionIndex: 0,
    });

    // 3. Generate Question
    const firstQuestion = await AdaptiveQuizEngine.generateAdaptiveQuestion(
      projectId,
      selection.concept,
      selection.difficulty,
      selection.type,
      selection.rationale,
      learningState
    );

    // 4. Create Adaptive Session
    const session = await AdaptiveSession.create({
      projectId,
      userId: req.user._id,
      totalQuestionsTarget: Math.max(3, Math.min(15, totalQuestions)),
      currentQuestionIndex: 0,
      focus,
      status: 'active',
      questions: [firstQuestion],
      answers: [],
      selectedConcepts: [selection.concept],
      mistakes: [],
      performance: {
        totalAnswered: 0,
        correctCount: 0,
        averageScore: 0,
        streak: 0,
      },
      conceptDeltas: [],
      projectContext: learningState.projectContext,
    });

    // Strip answers from response for user interface
    const sanitizedQuestion = {
      index: 0,
      question: firstQuestion.question,
      type: firstQuestion.type,
      choices: firstQuestion.choices,
      concept: firstQuestion.concept,
      difficulty: firstQuestion.difficulty,
      adaptiveRationale: firstQuestion.adaptiveRationale,
      rubricGuidelines: firstQuestion.rubric?.guidelines || null,
    };

    res.json({
      sessionId: session._id,
      totalQuestions: session.totalQuestionsTarget,
      currentQuestionIndex: 0,
      question: sanitizedQuestion,
      learningStateSummary: {
        masteryCount: learningState.masteryRecords.length,
        overallPastAccuracy: learningState.overallPastAccuracy,
        recentMistakesCount: learningState.pastMistakes.length,
      },
    });
  } catch (error) {
    console.error('Error starting adaptive quiz:', error);
    res.status(500).json({ message: error.message });
  }
});

// @route   GET /api/quizzes/projects/:projectId/adaptive/session/:sessionId
// @desc    Retrieve active adaptive quiz session state
// @access  Private
router.get('/projects/:projectId/adaptive/session/:sessionId', protect, async (req, res) => {
  try {
    const session = await AdaptiveSession.findOne({
      _id: req.params.sessionId,
      projectId: req.params.projectId,
      userId: req.user._id,
    });

    if (!session) {
      return res.status(404).json({ message: 'Adaptive session not found' });
    }

    const currentQ = session.questions[session.currentQuestionIndex];
    const sanitizedQuestion = currentQ
      ? {
          index: session.currentQuestionIndex,
          question: currentQ.question,
          type: currentQ.type,
          choices: currentQ.choices,
          concept: currentQ.concept,
          difficulty: currentQ.difficulty,
          adaptiveRationale: currentQ.adaptiveRationale,
        }
      : null;

    res.json({
      session,
      currentQuestion: sanitizedQuestion,
      isFinished: session.answers.length >= session.totalQuestionsTarget,
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// @route   POST /api/quizzes/projects/:projectId/adaptive/evaluate
// @desc    Submit user answer for current question, evaluate, and update Concept Mastery
// @access  Private
router.post('/projects/:projectId/adaptive/evaluate', protect, async (req, res) => {
  try {
    const { sessionId, questionIndex, userAnswer } = req.body;

    const session = await AdaptiveSession.findOne({
      _id: sessionId,
      projectId: req.params.projectId,
      userId: req.user._id,
    });

    if (!session) {
      return res.status(404).json({ message: 'Adaptive session not found' });
    }

    const question = session.questions[questionIndex];
    if (!question) {
      return res.status(400).json({ message: 'Question not found in session' });
    }

    // 1. Evaluate with Adaptive Engine (MCQ or Open-Ended with full criteria)
    const evaluation = await AdaptiveQuizEngine.evaluateAnswer(
      question,
      userAnswer,
      session.projectId,
      session.userId
    );

    // 2. Update Mastery & Growth System
    const masteryUpdate = await AdaptiveQuizEngine.updateMasteryAndRecommendations({
      projectId: session.projectId,
      userId: session.userId,
      concept: question.concept,
      isCorrect: evaluation.isCorrect,
      score: evaluation.score,
      questionType: question.type,
      feedback: evaluation.feedback,
    });

    // 3. Update Session Record
    session.answers.push({
      questionIndex,
      userAnswer,
      isCorrect: evaluation.isCorrect,
      score: evaluation.score,
      evaluationFeedback: evaluation.feedback,
      detailedEvaluation: evaluation.detailedEvaluation,
      answeredAt: new Date(),
    });

    session.conceptDeltas.push({
      concept: question.concept,
      beforeLevel: masteryUpdate.beforeLevel,
      afterLevel: masteryUpdate.afterLevel,
      change: masteryUpdate.change,
    });

    // Update performance metrics
    session.performance.totalAnswered += 1;
    if (evaluation.isCorrect) {
      session.performance.correctCount += 1;
      session.performance.streak += 1;
    } else {
      session.performance.streak = 0;
      session.mistakes.push({
        concept: question.concept,
        questionText: question.question,
        userAnswer,
        feedback: evaluation.feedback,
      });
    }

    const allScores = session.answers.map((a) => a.score || 0);
    session.performance.averageScore = Math.round(
      allScores.reduce((sum, val) => sum + val, 0) / allScores.length
    );

    session.updatedAt = new Date();
    await session.save();

    const isFinished = session.answers.length >= session.totalQuestionsTarget;

    res.json({
      evaluation: {
        isCorrect: evaluation.isCorrect,
        score: evaluation.score,
        feedback: evaluation.feedback,
        detailedEvaluation: evaluation.detailedEvaluation,
        explanation: question.explanation,
        correctAnswer: question.correctAnswer,
      },
      masteryDelta: masteryUpdate,
      isFinished,
      performance: session.performance,
    });
  } catch (error) {
    console.error('Error evaluating adaptive answer:', error);
    res.status(500).json({ message: error.message });
  }
});

// @route   POST /api/quizzes/projects/:projectId/adaptive/next
// @desc    Dynamically select concept & difficulty and generate next question
// @access  Private
router.post('/projects/:projectId/adaptive/next', protect, async (req, res) => {
  try {
    const { sessionId } = req.body;

    const session = await AdaptiveSession.findOne({
      _id: sessionId,
      projectId: req.params.projectId,
      userId: req.user._id,
    });

    if (!session) {
      return res.status(404).json({ message: 'Adaptive session not found' });
    }

    // Check if session has reached target questions
    if (session.answers.length >= session.totalQuestionsTarget) {
      return res.json({
        isFinished: true,
        message: 'All questions in this adaptive session have been completed.',
      });
    }

    // 1. Gather fresh learning evidence (including latest answer and updated mastery!)
    const learningState = await AdaptiveQuizEngine.understandCurrentLearningState(
      session.projectId,
      session.userId
    );

    // 2. Select next concept & difficulty using learning evidence
    const nextIndex = session.answers.length;
    session.currentQuestionIndex = nextIndex;

    const selection = AdaptiveQuizEngine.selectConceptAndDifficulty(learningState, session);

    // 3. Generate the next tailored question
    const nextQuestion = await AdaptiveQuizEngine.generateAdaptiveQuestion(
      session.projectId,
      selection.concept,
      selection.difficulty,
      selection.type,
      selection.rationale,
      learningState
    );

    session.questions.push(nextQuestion);
    if (!session.selectedConcepts.includes(selection.concept)) {
      session.selectedConcepts.push(selection.concept);
    }
    session.updatedAt = new Date();
    await session.save();

    const sanitizedQuestion = {
      index: nextIndex,
      question: nextQuestion.question,
      type: nextQuestion.type,
      choices: nextQuestion.choices,
      concept: nextQuestion.concept,
      difficulty: nextQuestion.difficulty,
      adaptiveRationale: nextQuestion.adaptiveRationale,
      rubricGuidelines: nextQuestion.rubric?.guidelines || null,
    };

    res.json({
      isFinished: false,
      questionIndex: nextIndex,
      totalQuestions: session.totalQuestionsTarget,
      question: sanitizedQuestion,
    });
  } catch (error) {
    console.error('Error generating next question:', error);
    res.status(500).json({ message: error.message });
  }
});

// @route   POST /api/quizzes/projects/:projectId/adaptive/finish
// @desc    Conclude adaptive session, create permanent QuizAttempt record, return assessment report
// @access  Private
router.post('/projects/:projectId/adaptive/finish', protect, async (req, res) => {
  try {
    const { sessionId } = req.body;

    const session = await AdaptiveSession.findOne({
      _id: sessionId,
      projectId: req.params.projectId,
      userId: req.user._id,
    });

    if (!session) {
      return res.status(404).json({ message: 'Adaptive session not found' });
    }

    session.status = 'completed';
    session.updatedAt = new Date();
    await session.save();

    // Map answers for QuizAttempt format
    const attemptAnswers = session.answers.map((ans) => {
      const q = session.questions[ans.questionIndex];
      return {
        questionIndex: ans.questionIndex,
        questionText: q?.question || '',
        questionType: q?.type || 'mcq',
        concept: q?.concept || 'General',
        difficulty: q?.difficulty || 'medium',
        userAnswer: ans.userAnswer,
        isCorrect: ans.isCorrect,
        score: ans.score || 0,
        evaluationFeedback: ans.evaluationFeedback,
        detailedEvaluation: ans.detailedEvaluation,
      };
    });

    const averageScore = session.performance.averageScore || 0;

    // Create persistent QuizAttempt record so it reflects across Analytics and Mastery
    const attempt = await QuizAttempt.create({
      quizId: null,
      projectId: session.projectId,
      userId: session.userId,
      answers: attemptAnswers,
      score: averageScore,
      totalQuestions: session.answers.length,
      mode: 'adaptive',
      conceptDeltas: session.conceptDeltas,
      takenAt: new Date(),
    });

    // Fetch updated mastery summary and active recommendations
    const masteryList = await Mastery.find({
      projectId: session.projectId,
      userId: session.userId,
    }).sort({ level: 1 });

    const activeRecommendations = await Recommendation.find({
      projectId: session.projectId,
      userId: session.userId,
      isCompleted: false,
    }).sort({ createdAt: -1 }).limit(5);

    res.json({
      attemptId: attempt._id,
      score: averageScore,
      correctCount: session.performance.correctCount,
      totalQuestions: session.answers.length,
      performance: session.performance,
      conceptDeltas: session.conceptDeltas,
      mistakes: session.mistakes,
      masterySummary: masteryList,
      recommendations: activeRecommendations,
    });
  } catch (error) {
    console.error('Error finalizing adaptive quiz:', error);
    res.status(500).json({ message: error.message });
  }
});

module.exports = router;

