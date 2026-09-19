import React, { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import api from '../services/api';
import {
  Award,
  ArrowLeft,
  CheckCircle2,
  XCircle,
  AlertCircle,
  Sparkles,
  HelpCircle,
  Brain,
  TrendingUp,
  RotateCcw,
  BookOpen,
  ChevronRight,
  Flame,
  Zap,
  MessageSquare
} from 'lucide-react';

export default function QuizPage() {
  const { projectId } = useParams();

  // Mode: 'hub' | 'adaptive_active' | 'adaptive_feedback' | 'adaptive_summary' | 'standard_active' | 'standard_summary'
  const [viewMode, setViewMode] = useState('hub');

  // Hub data
  const [standardQuizzes, setStandardQuizzes] = useState([]);
  const [recentAttempts, setRecentAttempts] = useState([]);
  const [loadingHub, setLoadingHub] = useState(true);

  // Adaptive Quiz Setup
  const [questionCountTarget, setQuestionCountTarget] = useState(5);
  const [startingAdaptive, setStartingAdaptive] = useState(false);

  // Active Adaptive State
  const [adaptiveSessionId, setAdaptiveSessionId] = useState(null);
  const [currentQuestion, setCurrentQuestion] = useState(null);
  const [questionIndex, setQuestionIndex] = useState(0);
  const [totalQuestions, setTotalQuestions] = useState(5);
  const [selectedOption, setSelectedOption] = useState(null);
  const [openEndedAnswer, setOpenEndedAnswer] = useState('');
  const [evaluating, setEvaluating] = useState(false);
  const [nextLoading, setNextLoading] = useState(false);

  // Turn Feedback State
  const [turnFeedback, setTurnFeedback] = useState(null);
  const [turnMasteryDelta, setTurnMasteryDelta] = useState(null);
  const [isSessionFinished, setIsSessionFinished] = useState(false);

  // Final Summary State
  const [finalReport, setFinalReport] = useState(null);

  // Standard Quiz State
  const [activeStandardQuiz, setActiveStandardQuiz] = useState(null);
  const [standardQIndex, setStandardQIndex] = useState(0);
  const [standardAnswers, setStandardAnswers] = useState({});
  const [standardSubmitting, setStandardSubmitting] = useState(false);
  const [standardResult, setStandardResult] = useState(null);

  useEffect(() => {
    fetchHubData();
  }, [projectId]);

  const fetchHubData = async () => {
    setLoadingHub(true);
    try {
      const res = await api.get(`/quizzes/projects/${projectId}`);
      if (res.data.quizzes) {
        setStandardQuizzes(res.data.quizzes);
        setRecentAttempts(res.data.recentAttempts || []);
      } else if (Array.isArray(res.data)) {
        setStandardQuizzes(res.data);
      }
    } catch (err) {
      console.error('Error fetching quizzes:', err);
    } finally {
      setLoadingHub(false);
    }
  };

  // Start Adaptive Quiz
  const handleStartAdaptiveQuiz = async () => {
    setStartingAdaptive(true);
    try {
      const res = await api.post(`/quizzes/projects/${projectId}/adaptive/start`, {
        totalQuestions: questionCountTarget,
      });

      setAdaptiveSessionId(res.data.sessionId);
      setTotalQuestions(res.data.totalQuestions);
      setQuestionIndex(res.data.currentQuestionIndex);
      setCurrentQuestion(res.data.question);
      setSelectedOption(null);
      setOpenEndedAnswer('');
      setTurnFeedback(null);
      setTurnMasteryDelta(null);
      setIsSessionFinished(false);
      setViewMode('adaptive_active');
    } catch (err) {
      console.error('Failed to start adaptive quiz:', err);
      alert(err.response?.data?.message || 'Could not start adaptive quiz session.');
    } finally {
      setStartingAdaptive(false);
    }
  };

  // Submit Answer for Immediate Adaptive Evaluation
  const handleSubmitAnswer = async () => {
    if (!currentQuestion) return;

    let answerToSubmit = null;
    if (currentQuestion.type === 'mcq') {
      if (selectedOption === null) {
        alert('Please select an option to submit.');
        return;
      }
      answerToSubmit = selectedOption;
    } else {
      if (!openEndedAnswer.trim()) {
        alert('Please provide your explanation before submitting.');
        return;
      }
      answerToSubmit = openEndedAnswer.trim();
    }

    setEvaluating(true);
    try {
      const res = await api.post(`/quizzes/projects/${projectId}/adaptive/evaluate`, {
        sessionId: adaptiveSessionId,
        questionIndex: questionIndex,
        userAnswer: answerToSubmit,
      });

      setTurnFeedback(res.data.evaluation);
      setTurnMasteryDelta(res.data.masteryDelta);
      setIsSessionFinished(res.data.isFinished);
      setViewMode('adaptive_feedback');
    } catch (err) {
      console.error('Failed to evaluate answer:', err);
      alert(err.response?.data?.message || 'Error evaluating answer.');
    } finally {
      setEvaluating(false);
    }
  };

  // Fetch Next Adaptive Question or Finish
  const handleNextOrFinish = async () => {
    if (isSessionFinished) {
      // Conclude session
      setNextLoading(true);
      try {
        const res = await api.post(`/quizzes/projects/${projectId}/adaptive/finish`, {
          sessionId: adaptiveSessionId,
        });
        setFinalReport(res.data);
        setViewMode('adaptive_summary');
        fetchHubData();
      } catch (err) {
        console.error('Failed to finalize adaptive quiz:', err);
      } finally {
        setNextLoading(false);
      }
    } else {
      // Request next question dynamically tailored to the newly updated mastery & mistakes
      setNextLoading(true);
      try {
        const res = await api.post(`/quizzes/projects/${projectId}/adaptive/next`, {
          sessionId: adaptiveSessionId,
        });

        if (res.data.isFinished) {
          setIsSessionFinished(true);
          handleNextOrFinish();
        } else {
          setCurrentQuestion(res.data.question);
          setQuestionIndex(res.data.questionIndex);
          setSelectedOption(null);
          setOpenEndedAnswer('');
          setTurnFeedback(null);
          setTurnMasteryDelta(null);
          setViewMode('adaptive_active');
        }
      } catch (err) {
        console.error('Failed to load next question:', err);
      } finally {
        setNextLoading(false);
      }
    }
  };

  // Standard Quiz Handlers
  const handleStartStandardQuiz = (quiz) => {
    setActiveStandardQuiz(quiz);
    setStandardQIndex(0);
    setStandardAnswers({});
    setStandardResult(null);
    setViewMode('standard_active');
  };

  const handleStandardOptionSelect = (choiceIdx) => {
    setStandardAnswers({
      ...standardAnswers,
      [standardQIndex]: choiceIdx,
    });
  };

  const handleSubmitStandardQuiz = async () => {
    if (!activeStandardQuiz) return;
    setStandardSubmitting(true);

    const formattedAnswers = activeStandardQuiz.questions.map((q, idx) => ({
      questionIndex: idx,
      userAnswer: standardAnswers[idx] !== undefined ? standardAnswers[idx] : -1,
    }));

    try {
      const res = await api.post(`/quizzes/projects/${projectId}/attempt`, {
        quizId: activeStandardQuiz._id,
        answers: formattedAnswers,
      });
      setStandardResult(res.data);
      setViewMode('standard_summary');
      fetchHubData();
    } catch (err) {
      console.error('Failed to submit standard quiz:', err);
    } finally {
      setStandardSubmitting(false);
    }
  };

  // -------------------------------------------------------------
  // RENDER: Loading State
  // -------------------------------------------------------------
  if (loadingHub) {
    return (
      <div className="min-h-[60vh] flex items-center justify-center">
        <div className="flex flex-col items-center gap-3">
          <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-emerald-600"></div>
          <p className="text-sm text-slate-500 font-medium">Loading Quiz & Assessment Hub...</p>
        </div>
      </div>
    );
  }

  // -------------------------------------------------------------
  // RENDER 1: Quiz Hub / Dashboard
  // -------------------------------------------------------------
  if (viewMode === 'hub') {
    return (
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Navigation */}
        <div className="mb-6">
          <Link
            to={`/projects/${projectId}`}
            className="inline-flex items-center gap-1.5 text-sm font-medium text-slate-500 hover:text-slate-800 transition"
          >
            <ArrowLeft className="w-4 h-4" />
            <span>Back to Project Dashboard</span>
          </Link>
        </div>

        {/* Header Banner */}
        <div className="mb-8">
          <div className="flex items-center gap-2 mb-1">
            <span className="px-2.5 py-0.5 bg-emerald-50 text-emerald-700 text-xs font-semibold rounded-full border border-emerald-200 flex items-center gap-1">
              <Sparkles className="w-3.5 h-3.5" /> Dynamic Assessment
            </span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-bold text-slate-900">Adaptive Quiz & Assessment</h1>
          <p className="text-slate-600 text-sm mt-1 max-w-2xl">
            Questions adapt in real-time to your concept mastery, previous mistakes, question history, and recent learning activity.
          </p>
        </div>

        {/* Adaptive Assessment Hero Card */}
        <div className="bg-gradient-to-br from-emerald-900 via-slate-900 to-indigo-950 rounded-2xl p-6 sm:p-8 text-white shadow-xl mb-10 relative overflow-hidden">
          <div className="absolute -right-12 -bottom-12 w-64 h-64 bg-emerald-500/10 rounded-full blur-3xl pointer-events-none"></div>
          <div className="relative z-10 max-w-2xl">
            <div className="flex items-center gap-2 mb-3">
              <Brain className="w-5 h-5 text-emerald-400" />
              <span className="text-xs font-semibold uppercase tracking-wider text-emerald-400">Personalized Learning Engine</span>
            </div>
            <h2 className="text-xl sm:text-2xl font-bold text-white mb-2">
              Launch an Adaptive Assessment Session
            </h2>
            <p className="text-slate-300 text-sm mb-6 leading-relaxed">
              The engine diagnoses your knowledge gaps across Multiple-Choice and Open-Ended reasoning questions. Rather than simple Wrong → Easy or Correct → Hard switches, it selects concepts requiring practice and adapts difficulty based on your Zone of Proximal Development.
            </p>

            {/* Session Settings */}
            <div className="flex flex-wrap items-center gap-4 mb-6">
              <div className="flex items-center gap-2">
                <span className="text-xs font-medium text-slate-300">Target Questions:</span>
                {[3, 5, 8].map((count) => (
                  <button
                    key={count}
                    onClick={() => setQuestionCountTarget(count)}
                    className={`px-3 py-1 text-xs font-semibold rounded-lg transition ${
                      questionCountTarget === count
                        ? 'bg-emerald-500 text-white shadow'
                        : 'bg-white/10 text-slate-300 hover:bg-white/20'
                    }`}
                  >
                    {count} {count === 3 ? '(Quick)' : count === 5 ? '(Standard)' : '(Deep)'}
                  </button>
                ))}
              </div>
            </div>

            {/* CTA Button */}
            <button
              onClick={handleStartAdaptiveQuiz}
              disabled={startingAdaptive}
              className="inline-flex items-center gap-2 px-6 py-3 bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-semibold text-sm rounded-xl shadow-lg transition disabled:opacity-50"
            >
              <Sparkles className="w-4 h-4" />
              <span>{startingAdaptive ? 'Initializing Adaptive Engine...' : 'Start Adaptive Quiz Now'}</span>
            </button>
          </div>

          {/* Engine Pillars */}
          <div className="mt-8 pt-6 border-t border-white/10 grid grid-cols-2 sm:grid-cols-4 gap-4 text-xs text-slate-300">
            <div className="flex items-center gap-2">
              <div className="w-2 h-2 rounded-full bg-emerald-400"></div>
              <span>Concept Mastery Driven</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-2 h-2 rounded-full bg-blue-400"></div>
              <span>MCQ & Open-Ended</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-2 h-2 rounded-full bg-purple-400"></div>
              <span>Misconception Diagnosis</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-2 h-2 rounded-full bg-amber-400"></div>
              <span>Multi-Criteria AI Feedback</span>
            </div>
          </div>
        </div>

        {/* Content Columns: Recent History & Saved Quizzes */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Saved Quizzes */}
          <div className="lg:col-span-2 space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-base font-bold text-slate-900 flex items-center gap-2">
                <BookOpen className="w-4 h-4 text-slate-600" />
                <span>Curated & Course Quizzes</span>
              </h2>
              <span className="text-xs text-slate-400 font-medium">{standardQuizzes.length} available</span>
            </div>

            {standardQuizzes.length === 0 ? (
              <div className="bg-white border border-slate-200 rounded-2xl p-8 text-center shadow-sm">
                <div className="w-12 h-12 bg-slate-50 text-slate-400 rounded-xl flex items-center justify-center mx-auto mb-3">
                  <Award className="w-6 h-6" />
                </div>
                <h3 className="text-sm font-semibold text-slate-900 mb-1">No Pre-packaged Quizzes Yet</h3>
                <p className="text-slate-500 text-xs max-w-sm mx-auto mb-4">
                  Start an adaptive quiz session above to generate personalized questions from your uploaded materials.
                </p>
                <button
                  onClick={handleStartAdaptiveQuiz}
                  className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold rounded-lg transition"
                >
                  Start Adaptive Session
                </button>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {standardQuizzes.map((quiz) => (
                  <div
                    key={quiz._id}
                    className="bg-white border border-slate-200 hover:border-emerald-300 rounded-2xl p-5 shadow-sm flex flex-col justify-between transition"
                  >
                    <div>
                      <h3 className="font-semibold text-slate-900 text-sm leading-snug">{quiz.title}</h3>
                      <p className="text-xs text-slate-500 mt-1">
                        {quiz.questions?.length || 0} Questions • Concepts: {quiz.targetConcepts?.join(', ') || 'General'}
                      </p>
                    </div>
                    <button
                      onClick={() => handleStartStandardQuiz(quiz)}
                      className="mt-5 w-full py-2 bg-slate-100 hover:bg-emerald-600 hover:text-white text-slate-700 text-xs font-semibold rounded-xl transition"
                    >
                      Take Quiz
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Past Assessment Attempts */}
          <div className="space-y-4">
            <h2 className="text-base font-bold text-slate-900 flex items-center gap-2">
              <TrendingUp className="w-4 h-4 text-slate-600" />
              <span>Recent Quiz Performance</span>
            </h2>

            {recentAttempts.length === 0 ? (
              <div className="bg-white border border-slate-200 rounded-2xl p-6 text-center shadow-sm">
                <p className="text-xs text-slate-400">No attempts recorded yet. Launch your first quiz to track performance.</p>
              </div>
            ) : (
              <div className="bg-white border border-slate-200 rounded-2xl p-4 shadow-sm divide-y divide-slate-100">
                {recentAttempts.map((att) => (
                  <div key={att._id} className="py-3 flex items-center justify-between text-xs">
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-semibold text-slate-800">
                          {att.mode === 'adaptive' ? '🧠 Adaptive Session' : 'Standard Quiz'}
                        </span>
                      </div>
                      <span className="text-[11px] text-slate-400">
                        {new Date(att.takenAt).toLocaleDateString()} • {att.totalQuestions} questions
                      </span>
                    </div>
                    <span
                      className={`font-bold px-2 py-0.5 rounded-full text-xs ${
                        att.score >= 75
                          ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                          : att.score >= 50
                          ? 'bg-blue-50 text-blue-700 border border-blue-200'
                          : 'bg-amber-50 text-amber-700 border border-amber-200'
                      }`}
                    >
                      {att.score}%
                    </span>
                  </div>
                ))}
              </div>
            )}

            <div className="p-4 rounded-xl bg-blue-50/60 border border-blue-100 text-xs text-blue-800">
              <p className="font-semibold mb-1 flex items-center gap-1.5">
                <Zap className="w-3.5 h-3.5" /> Concept Mastery Sync
              </p>
              <p className="text-blue-700 leading-relaxed">
                Every question answered directly updates your Concept Mastery levels and unlocks targeted recommendations.
              </p>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // -------------------------------------------------------------
  // RENDER 2: Active Adaptive Question
  // -------------------------------------------------------------
  if (viewMode === 'adaptive_active' && currentQuestion) {
    const isMCQ = currentQuestion.type === 'mcq';

    return (
      <div className="max-w-3xl mx-auto px-4 sm:px-6 py-8">
        {/* Top Controls */}
        <div className="flex items-center justify-between mb-6 text-xs text-slate-500">
          <button
            onClick={() => {
              if (window.confirm('Do you want to exit the current adaptive quiz? Your progress will be saved.')) {
                setViewMode('hub');
                fetchHubData();
              }
            }}
            className="inline-flex items-center gap-1 text-slate-500 hover:text-slate-800 transition"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            <span>Exit Quiz</span>
          </button>
          <div className="flex items-center gap-2 font-medium">
            <span>Adaptive Question {questionIndex + 1} of {totalQuestions}</span>
          </div>
        </div>

        {/* Progress Bar */}
        <div className="w-full h-2 bg-slate-100 rounded-full overflow-hidden mb-6">
          <div
            className="h-full bg-emerald-500 transition-all duration-300"
            style={{ width: `${((questionIndex + 1) / totalQuestions) * 100}%` }}
          />
        </div>

        {/* Adaptive Intelligence Rationale Pill */}
        <div className="mb-6 p-4 rounded-2xl bg-slate-900 text-white shadow-sm border border-slate-800">
          <div className="flex flex-wrap items-center justify-between gap-2 mb-2">
            <div className="flex items-center gap-2">
              <span className="px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-400 font-semibold text-[11px] border border-emerald-500/30 uppercase tracking-wider">
                {currentQuestion.concept}
              </span>
              <span className={`px-2 py-0.5 rounded-full text-[11px] font-semibold uppercase tracking-wider ${
                currentQuestion.difficulty === 'hard'
                  ? 'bg-rose-500/20 text-rose-300 border border-rose-500/30'
                  : currentQuestion.difficulty === 'medium'
                  ? 'bg-blue-500/20 text-blue-300 border border-blue-500/30'
                  : 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
              }`}>
                {currentQuestion.difficulty}
              </span>
            </div>
            <span className="text-[11px] text-slate-400 font-medium">
              {isMCQ ? 'Multiple-Choice Question' : 'Open-Ended Analytical Prompt'}
            </span>
          </div>

          {currentQuestion.adaptiveRationale && (
            <p className="text-xs text-slate-300 flex items-start gap-1.5 leading-relaxed">
              <Brain className="w-4 h-4 text-emerald-400 flex-shrink-0 mt-0.5" />
              <span>{currentQuestion.adaptiveRationale}</span>
            </p>
          )}
        </div>

        {/* Question Card */}
        <div className="bg-white border border-slate-200 rounded-2xl p-6 sm:p-8 shadow-sm">
          <h2 className="text-lg font-bold text-slate-900 mb-6 leading-relaxed">
            {currentQuestion.question}
          </h2>

          {/* If MCQ */}
          {isMCQ ? (
            <div className="space-y-3 mb-8">
              {currentQuestion.choices?.map((choice, cIdx) => {
                const isSelected = selectedOption === cIdx;
                const letter = String.fromCharCode(65 + cIdx);
                return (
                  <button
                    key={cIdx}
                    onClick={() => setSelectedOption(cIdx)}
                    className={`w-full text-left p-4 rounded-xl border text-sm transition flex items-center justify-between ${
                      isSelected
                        ? 'border-emerald-600 bg-emerald-50/70 text-emerald-950 font-medium shadow-sm'
                        : 'border-slate-200 hover:border-slate-300 bg-white text-slate-700'
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      <span className={`w-7 h-7 rounded-lg text-xs font-bold flex items-center justify-center transition ${
                        isSelected ? 'bg-emerald-600 text-white' : 'bg-slate-100 text-slate-600'
                      }`}>
                        {letter}
                      </span>
                      <span>{choice}</span>
                    </div>
                    <div className={`w-5 h-5 rounded-full border flex items-center justify-center ${
                      isSelected ? 'border-emerald-600 bg-emerald-600 text-white' : 'border-slate-300'
                    }`}>
                      {isSelected && <div className="w-2 h-2 rounded-full bg-white" />}
                    </div>
                  </button>
                );
              })}
            </div>
          ) : (
            /* If Open-Ended */
            <div className="mb-8">
              <div className="mb-2 flex items-center justify-between text-xs text-slate-500">
                <span>Write your explanation in your own words:</span>
                <span>{openEndedAnswer.length} characters</span>
              </div>
              <textarea
                rows={5}
                value={openEndedAnswer}
                onChange={(e) => setOpenEndedAnswer(e.target.value)}
                placeholder="Explain the mechanism, principles, and reasoning clearly. Mention relevant components and why they matter..."
                className="w-full p-4 text-sm text-slate-800 bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500/30 focus:border-emerald-500 transition"
              />
              <p className="text-[11px] text-slate-400 mt-2 flex items-center gap-1.5">
                <Sparkles className="w-3.5 h-3.5 text-emerald-600" />
                <span>AI will evaluate understanding, accuracy, relevance, reasoning, and key concepts covered.</span>
              </p>
            </div>
          )}

          {/* Submit Action */}
          <div className="pt-4 border-t border-slate-100 flex justify-end">
            <button
              onClick={handleSubmitAnswer}
              disabled={evaluating}
              className="px-6 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-semibold rounded-xl shadow-sm transition disabled:opacity-50 flex items-center gap-2"
            >
              {evaluating ? (
                <>
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                  <span>Evaluating Answer...</span>
                </>
              ) : (
                <>
                  <span>Submit for Evaluation</span>
                  <ChevronRight className="w-4 h-4" />
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    );
  }

  // -------------------------------------------------------------
  // RENDER 3: Immediate Turn Feedback (Evaluation Screen)
  // -------------------------------------------------------------
  if (viewMode === 'adaptive_feedback' && turnFeedback) {
    const isCorrect = turnFeedback.isCorrect;
    const score = turnFeedback.score;
    const detailed = turnFeedback.detailedEvaluation || {};

    return (
      <div className="max-w-3xl mx-auto px-4 sm:px-6 py-8">
        {/* Banner */}
        <div className={`p-6 rounded-2xl shadow-sm mb-6 border ${
          isCorrect
            ? 'bg-emerald-50 border-emerald-200 text-emerald-950'
            : score >= 50
            ? 'bg-amber-50 border-amber-200 text-amber-950'
            : 'bg-rose-50 border-rose-200 text-rose-950'
        }`}>
          <div className="flex items-start justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${
                isCorrect ? 'bg-emerald-600 text-white' : score >= 50 ? 'bg-amber-600 text-white' : 'bg-rose-600 text-white'
              }`}>
                {isCorrect ? <CheckCircle2 className="w-6 h-6" /> : score >= 50 ? <AlertCircle className="w-6 h-6" /> : <XCircle className="w-6 h-6" />}
              </div>
              <div>
                <h2 className="font-bold text-base">
                  {isCorrect ? 'Concept Understood!' : score >= 50 ? 'Partial Understanding' : 'Remediation Needed'}
                </h2>
                <p className="text-xs opacity-90 mt-0.5">
                  Evaluated on concept: <strong>{currentQuestion?.concept}</strong>
                </p>
              </div>
            </div>

            <div className="text-right">
              <span className={`text-xl font-extrabold px-3 py-1 rounded-xl text-sm ${
                isCorrect ? 'bg-emerald-200/60 text-emerald-900' : 'bg-amber-200/60 text-amber-900'
              }`}>
                {score}%
              </span>
            </div>
          </div>
        </div>

        {/* Real-Time Concept Mastery Impact */}
        {turnMasteryDelta && (
          <div className="bg-white border border-slate-200 rounded-2xl p-5 mb-6 shadow-sm">
            <div className="flex items-center justify-between text-xs mb-2">
              <span className="font-semibold text-slate-700 flex items-center gap-1.5">
                <TrendingUp className="w-4 h-4 text-emerald-600" />
                <span>Concept Mastery Updated</span>
              </span>
              <span className="font-bold text-slate-900">
                {turnMasteryDelta.beforeLevel}% ➔ {turnMasteryDelta.afterLevel}% ({turnMasteryDelta.change >= 0 ? `+${turnMasteryDelta.change}` : turnMasteryDelta.change}%)
              </span>
            </div>
            <div className="w-full h-2.5 bg-slate-100 rounded-full overflow-hidden">
              <div
                className={`h-full rounded-full transition-all duration-700 ${
                  turnMasteryDelta.afterLevel >= 75
                    ? 'bg-emerald-500'
                    : turnMasteryDelta.afterLevel >= 50
                    ? 'bg-blue-500'
                    : 'bg-amber-500'
                }`}
                style={{ width: `${turnMasteryDelta.afterLevel}%` }}
              />
            </div>
          </div>
        )}

        {/* Detailed Qualitative Feedback */}
        <div className="bg-white border border-slate-200 rounded-2xl p-6 sm:p-8 shadow-sm mb-6 space-y-6">
          <div>
            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-2">AI Pedagogical Feedback</h3>
            <p className="text-sm text-slate-800 leading-relaxed bg-slate-50 p-4 rounded-xl border border-slate-100">
              {turnFeedback.feedback}
            </p>
          </div>

          {/* Multi-Dimensional Criteria Grid for Open-Ended */}
          {currentQuestion?.type === 'open_ended' && (
            <div>
              <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-3">Multi-Dimensional Rubric Evaluation</h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                <div className="p-3 rounded-xl bg-slate-50 border border-slate-100">
                  <span className="font-semibold text-slate-700">Understanding</span>
                  <p className="text-slate-600 mt-1">{detailed.understanding || 'Evaluated'}</p>
                </div>
                <div className="p-3 rounded-xl bg-slate-50 border border-slate-100">
                  <span className="font-semibold text-slate-700">Technical Accuracy</span>
                  <p className="text-slate-600 mt-1">{detailed.accuracy || 'Evaluated'}</p>
                </div>
                <div className="p-3 rounded-xl bg-slate-50 border border-slate-100">
                  <span className="font-semibold text-slate-700">Relevance</span>
                  <p className="text-slate-600 mt-1">{detailed.relevance || 'Directly relevant'}</p>
                </div>
                <div className="p-3 rounded-xl bg-slate-50 border border-slate-100">
                  <span className="font-semibold text-slate-700">Reasoning & Depth</span>
                  <p className="text-slate-600 mt-1">{detailed.reasoning || 'Satisfactory'}</p>
                </div>
              </div>

              {/* Concepts Tags */}
              <div className="mt-4 pt-4 border-t border-slate-100 space-y-3">
                {detailed.keyConceptsCovered && detailed.keyConceptsCovered.length > 0 && (
                  <div>
                    <span className="text-[11px] font-semibold text-emerald-700 uppercase tracking-wider block mb-1.5">
                      ✓ Key Concepts Demonstrated:
                    </span>
                    <div className="flex flex-wrap gap-1.5">
                      {detailed.keyConceptsCovered.map((kc, i) => (
                        <span key={i} className="px-2 py-0.5 rounded-md bg-emerald-50 text-emerald-800 border border-emerald-200 text-xs">
                          {kc}
                        </span>
                      ))}
                    </div>
                  </div>
                )}

                {detailed.missingConcepts && detailed.missingConcepts.length > 0 && (
                  <div>
                    <span className="text-[11px] font-semibold text-amber-700 uppercase tracking-wider block mb-1.5">
                      ⚠ Missing Concepts to Review:
                    </span>
                    <div className="flex flex-wrap gap-1.5">
                      {detailed.missingConcepts.map((mc, i) => (
                        <span key={i} className="px-2 py-0.5 rounded-md bg-amber-50 text-amber-800 border border-amber-200 text-xs">
                          {mc}
                        </span>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Continue Action */}
          <div className="pt-4 border-t border-slate-100 flex items-center justify-between">
            <span className="text-xs text-slate-400">
              {isSessionFinished ? 'All session questions answered.' : 'The engine will adapt the next question to this result.'}
            </span>

            <button
              onClick={handleNextOrFinish}
              disabled={nextLoading}
              className="px-6 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-semibold rounded-xl shadow-sm transition flex items-center gap-2 disabled:opacity-50"
            >
              {nextLoading ? (
                <span>Loading Next Adaptive Turn...</span>
              ) : isSessionFinished ? (
                <>
                  <span>View Final Assessment Report</span>
                  <ChevronRight className="w-4 h-4" />
                </>
              ) : (
                <>
                  <span>Next Adaptive Question</span>
                  <ChevronRight className="w-4 h-4" />
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    );
  }

  // -------------------------------------------------------------
  // RENDER 4: Final Adaptive Assessment Report
  // -------------------------------------------------------------
  if (viewMode === 'adaptive_summary' && finalReport) {
    const score = finalReport.score;
    const deltas = finalReport.conceptDeltas || [];
    const recommendations = finalReport.recommendations || [];

    return (
      <div className="max-w-4xl mx-auto px-4 sm:px-6 py-8">
        <div className="bg-white border border-slate-200 rounded-3xl p-8 sm:p-10 shadow-sm text-center mb-8">
          <div className="w-16 h-16 bg-emerald-50 text-emerald-600 rounded-2xl flex items-center justify-center mx-auto mb-4 shadow-sm">
            <Award className="w-9 h-9" />
          </div>

          <h2 className="text-2xl sm:text-3xl font-bold text-slate-900 mb-1">
            Adaptive Assessment Completed!
          </h2>
          <p className="text-sm text-slate-500 mb-6 max-w-md mx-auto">
            You achieved an overall score of {score}%. Your concept mastery has been updated across your learning profile.
          </p>

          <div className="w-full max-w-sm mx-auto h-3.5 bg-slate-100 rounded-full overflow-hidden mb-8">
            <div
              className={`h-full rounded-full transition-all duration-700 ${
                score >= 75 ? 'bg-emerald-500' : score >= 50 ? 'bg-blue-500' : 'bg-amber-500'
              }`}
              style={{ width: `${score}%` }}
            />
          </div>

          <div className="flex flex-wrap items-center justify-center gap-3">
            <button
              onClick={() => {
                setViewMode('hub');
                fetchHubData();
              }}
              className="px-5 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold text-xs rounded-xl transition"
            >
              Back to Quizzes
            </button>
            <Link
              to={`/projects/${projectId}/mastery`}
              className="px-5 py-2.5 bg-blue-600 hover:bg-blue-700 text-white font-semibold text-xs rounded-xl shadow-sm transition"
            >
              View Mastery & Growth Analysis
            </Link>
            <Link
              to={`/projects/${projectId}/tutor`}
              className="px-5 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white font-semibold text-xs rounded-xl shadow-sm transition flex items-center gap-1.5"
            >
              <MessageSquare className="w-3.5 h-3.5" />
              <span>Ask Tutor About Mistakes</span>
            </Link>
          </div>
        </div>

        {/* Growth & Concept Deltas */}
        {deltas.length > 0 && (
          <div className="bg-white border border-slate-200 rounded-2xl p-6 sm:p-8 shadow-sm mb-8">
            <h3 className="font-bold text-slate-900 text-base mb-4 flex items-center gap-2">
              <TrendingUp className="w-4 h-4 text-emerald-600" />
              <span>Concept Mastery Deltas</span>
            </h3>
            <div className="space-y-3">
              {deltas.map((d, idx) => (
                <div key={idx} className="p-3.5 rounded-xl border border-slate-100 bg-slate-50/70 flex items-center justify-between text-xs">
                  <div>
                    <span className="font-semibold text-slate-900">{d.concept}</span>
                    <span className="text-slate-400 ml-2">
                      {d.beforeLevel}% ➔ {d.afterLevel}%
                    </span>
                  </div>
                  <span className={`font-bold px-2.5 py-0.5 rounded-full text-xs ${
                    d.change >= 0 ? 'bg-emerald-100 text-emerald-800' : 'bg-rose-100 text-rose-800'
                  }`}>
                    {d.change >= 0 ? `+${d.change}% Growth` : `${d.change}%`}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Generated Recommendations */}
        {recommendations.length > 0 && (
          <div className="bg-white border border-slate-200 rounded-2xl p-6 sm:p-8 shadow-sm">
            <h3 className="font-bold text-slate-900 text-base mb-4 flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-amber-500" />
              <span>Targeted Next Steps Generated</span>
            </h3>
            <div className="space-y-3">
              {recommendations.map((rec) => (
                <div key={rec._id} className="p-4 rounded-xl border border-blue-100 bg-blue-50/40 text-xs">
                  <h4 className="font-semibold text-slate-900 text-sm">{rec.title}</h4>
                  <p className="text-slate-600 mt-1 leading-relaxed">{rec.text}</p>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    );
  }

  // -------------------------------------------------------------
  // RENDER 5: Standard Quiz Active / Summary
  // -------------------------------------------------------------
  if (viewMode === 'standard_active' && activeStandardQuiz) {
    const q = activeStandardQuiz.questions[standardQIndex];

    return (
      <div className="max-w-3xl mx-auto px-4 sm:px-6 py-8">
        <div className="flex items-center justify-between mb-6 text-xs text-slate-400">
          <span className="font-semibold text-slate-700">{activeStandardQuiz.title}</span>
          <span>
            Question {standardQIndex + 1} of {activeStandardQuiz.questions.length}
          </span>
        </div>

        <div className="w-full h-1.5 bg-slate-100 rounded-full overflow-hidden mb-6">
          <div
            className="h-full bg-blue-600 transition-all duration-300"
            style={{ width: `${((standardQIndex + 1) / activeStandardQuiz.questions.length) * 100}%` }}
          />
        </div>

        <div className="bg-white border border-slate-200 rounded-2xl p-6 sm:p-8 shadow-sm">
          <h3 className="text-lg font-bold text-slate-900 mb-6 leading-snug">
            {q?.question}
          </h3>

          <div className="space-y-3 mb-8">
            {q?.choices?.map((choice, cIdx) => (
              <button
                key={cIdx}
                onClick={() => handleStandardOptionSelect(cIdx)}
                className={`w-full text-left p-4 rounded-xl border text-sm transition flex items-center justify-between ${
                  standardAnswers[standardQIndex] === cIdx
                    ? 'border-blue-600 bg-blue-50/70 text-blue-900 font-medium'
                    : 'border-slate-200 hover:border-slate-300 bg-white text-slate-700'
                }`}
              >
                <span>{choice}</span>
                <div
                  className={`w-5 h-5 rounded-full border flex items-center justify-center ${
                    standardAnswers[standardQIndex] === cIdx
                      ? 'border-blue-600 bg-blue-600 text-white'
                      : 'border-slate-300'
                  }`}
                >
                  {standardAnswers[standardQIndex] === cIdx && <div className="w-2 h-2 rounded-full bg-white" />}
                </div>
              </button>
            ))}
          </div>

          <div className="flex items-center justify-between pt-4 border-t border-slate-100">
            <button
              disabled={standardQIndex === 0}
              onClick={() => setStandardQIndex((prev) => prev - 1)}
              className="px-4 py-2 text-sm font-medium text-slate-600 hover:bg-slate-100 rounded-lg transition disabled:opacity-30"
            >
              Previous
            </button>

            {standardQIndex < activeStandardQuiz.questions.length - 1 ? (
              <button
                onClick={() => setStandardQIndex((prev) => prev + 1)}
                className="px-5 py-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium rounded-lg shadow-sm transition"
              >
                Next Question
              </button>
            ) : (
              <button
                onClick={handleSubmitStandardQuiz}
                disabled={standardSubmitting}
                className="px-6 py-2 bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-medium rounded-lg shadow-sm transition disabled:opacity-50"
              >
                {standardSubmitting ? 'Submitting...' : 'Complete & Evaluate'}
              </button>
            )}
          </div>
        </div>
      </div>
    );
  }

  if (viewMode === 'standard_summary' && standardResult) {
    return (
      <div className="max-w-3xl mx-auto px-4 sm:px-6 py-8">
        <div className="bg-white border border-slate-200 rounded-2xl p-8 shadow-sm text-center">
          <div className="w-14 h-14 bg-emerald-50 text-emerald-600 rounded-2xl flex items-center justify-center mx-auto mb-4">
            <Award className="w-8 h-8" />
          </div>
          <h2 className="text-2xl font-bold text-slate-900 mb-1">Quiz Completed!</h2>
          <p className="text-sm text-slate-500 mb-6">
            You scored {standardResult.score}% ({standardResult.correctCount} / {standardResult.totalQuestions} correct)
          </p>

          <div className="w-full max-w-xs mx-auto h-3 bg-slate-100 rounded-full overflow-hidden mb-8">
            <div
              className={`h-full rounded-full transition-all duration-700 ${
                standardResult.score >= 75 ? 'bg-emerald-500' : standardResult.score >= 50 ? 'bg-blue-500' : 'bg-amber-500'
              }`}
              style={{ width: `${standardResult.score}%` }}
            />
          </div>

          <div className="flex items-center justify-center gap-3">
            <button
              onClick={() => {
                setViewMode('hub');
                fetchHubData();
              }}
              className="px-5 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-medium text-sm rounded-xl transition"
            >
              Back to Quizzes
            </button>
            <Link
              to={`/projects/${projectId}/mastery`}
              className="px-5 py-2.5 bg-blue-600 hover:bg-blue-700 text-white font-medium text-sm rounded-xl transition shadow-sm"
            >
              View Updated Mastery
            </Link>
          </div>
        </div>
      </div>
    );
  }

  return null;
}
