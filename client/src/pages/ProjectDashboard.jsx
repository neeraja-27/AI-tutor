import React, { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import api from '../services/api';
import {
  BookOpen,
  MessageSquare,
  FileText,
  Award,
  TrendingUp,
  BarChart3,
  ArrowLeft,
  UploadCloud,
  CheckCircle2,
  Clock,
  Sparkles,
  AlertCircle
} from 'lucide-react';

export default function ProjectDashboard() {
  const { projectId } = useParams();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchProjectData();
  }, [projectId]);

  const fetchProjectData = async () => {
    try {
      const res = await api.get(`/projects/${projectId}`);
      setData(res.data);
    } catch (err) {
      console.error('Error fetching project:', err);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-[60vh] flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  if (!data || !data.project) {
    return (
      <div className="max-w-7xl mx-auto px-4 py-12 text-center">
        <p className="text-slate-600">Project not found or you do not have permission to view it.</p>
        <Link to="/spaces" className="mt-4 inline-block text-blue-600 font-medium">Return to Spaces</Link>
      </div>
    );
  }

  const { project, materials = [], mastery = [], recommendations = [] } = data;
  const readyMaterialsCount = materials.filter((m) => m.status === 'ready').length;

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      {/* Back button */}
      <div className="mb-4">
        <Link
          to={`/spaces/${project.spaceId}/projects`}
          className="inline-flex items-center gap-1.5 text-sm font-medium text-slate-500 hover:text-slate-800 transition"
        >
          <ArrowLeft className="w-4 h-4" />
          <span>Back to Projects</span>
        </Link>
      </div>

      {/* Project Header Banner */}
      <div className="bg-white border border-slate-200 rounded-2xl p-6 sm:p-8 shadow-sm mb-8">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 mb-2">
              <span className="px-2.5 py-0.5 bg-blue-50 text-blue-700 text-xs font-semibold rounded-full border border-blue-200">
                Active Project
              </span>
              <span className="text-xs text-slate-400">Created {new Date(project.createdAt).toLocaleDateString()}</span>
            </div>
            <h1 className="text-2xl sm:text-3xl font-bold text-slate-900">{project.name}</h1>
            <p className="text-slate-600 text-sm mt-1 max-w-2xl">{project.description || 'No description'}</p>
            {project.learningGoal && (
              <p className="text-xs font-medium text-blue-600 mt-2 bg-blue-50/60 p-2 rounded-lg inline-block">
                🎯 <strong>Goal:</strong> {project.learningGoal}
              </p>
            )}
          </div>

          <div className="flex items-center gap-3">
            <Link
              to={`/projects/${projectId}/tutor`}
              className="inline-flex items-center gap-2 px-5 py-2.5 bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium rounded-xl shadow-sm transition"
            >
              <MessageSquare className="w-4 h-4" />
              <span>Launch AI Tutor</span>
            </Link>
          </div>
        </div>
      </div>

      {/* Primary Action Modules Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5 mb-8">
        <Link
          to={`/projects/${projectId}/materials`}
          className="bg-white border border-slate-200 hover:border-blue-400 hover:shadow-md p-5 rounded-2xl transition group"
        >
          <div className="w-10 h-10 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center mb-3 group-hover:bg-blue-600 group-hover:text-white transition">
            <FileText className="w-5 h-5" />
          </div>
          <h3 className="font-semibold text-slate-900 group-hover:text-blue-600 transition">Learning Materials</h3>
          <p className="text-xs text-slate-500 mt-1">
            {readyMaterialsCount} / {materials.length} PDFs Indexed
          </p>
        </Link>

        <Link
          to={`/projects/${projectId}/tutor`}
          className="bg-white border border-slate-200 hover:border-blue-400 hover:shadow-md p-5 rounded-2xl transition group"
        >
          <div className="w-10 h-10 rounded-xl bg-indigo-50 text-indigo-600 flex items-center justify-center mb-3 group-hover:bg-indigo-600 group-hover:text-white transition">
            <MessageSquare className="w-5 h-5" />
          </div>
          <h3 className="font-semibold text-slate-900 group-hover:text-indigo-600 transition">Grounded AI Tutor</h3>
          <p className="text-xs text-slate-500 mt-1">Interactive RAG Q&A with Citations</p>
        </Link>

        <Link
          to={`/projects/${projectId}/quizzes`}
          className="bg-white border border-slate-200 hover:border-blue-400 hover:shadow-md p-5 rounded-2xl transition group"
        >
          <div className="w-10 h-10 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center mb-3 group-hover:bg-emerald-600 group-hover:text-white transition">
            <Award className="w-5 h-5" />
          </div>
          <h3 className="font-semibold text-slate-900 group-hover:text-emerald-600 transition">Adaptive Quizzes</h3>
          <p className="text-xs text-slate-500 mt-1">Test your concept understanding</p>
        </Link>

        <Link
          to={`/projects/${projectId}/mastery`}
          className="bg-white border border-slate-200 hover:border-blue-400 hover:shadow-md p-5 rounded-2xl transition group"
        >
          <div className="w-10 h-10 rounded-xl bg-purple-50 text-purple-600 flex items-center justify-center mb-3 group-hover:bg-purple-600 group-hover:text-white transition">
            <TrendingUp className="w-5 h-5" />
          </div>
          <h3 className="font-semibold text-slate-900 group-hover:text-purple-600 transition">Mastery & Growth</h3>
          <p className="text-xs text-slate-500 mt-1">{mastery.length} Concepts Tracked</p>
        </Link>
      </div>

      {/* Recommended Next Actions & Concept Mastery Overview */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Recommended Actions */}
        <div className="lg:col-span-2 bg-white border border-slate-200 rounded-2xl p-6 shadow-sm">
          <div className="flex items-center gap-2 mb-4">
            <Sparkles className="w-5 h-5 text-amber-500" />
            <h2 className="font-bold text-slate-900">Recommended Next Steps</h2>
          </div>

          {recommendations.length === 0 ? (
            <div className="p-6 bg-slate-50 rounded-xl text-center">
              <p className="text-sm text-slate-600 mb-2">No active recommendations right now.</p>
              <p className="text-xs text-slate-400">
                Upload course PDFs or take an adaptive quiz to generate targeted insights.
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              {recommendations.map((rec) => (
                <div
                  key={rec._id}
                  className="p-4 rounded-xl border border-slate-200 bg-slate-50/50 hover:bg-white hover:shadow-sm transition flex items-start gap-3.5"
                >
                  <div className="p-2 rounded-lg bg-blue-100 text-blue-700 mt-0.5">
                    <Sparkles className="w-4 h-4" />
                  </div>
                  <div className="flex-1">
                    <h4 className="text-sm font-semibold text-slate-900">{rec.title}</h4>
                    <p className="text-xs text-slate-600 mt-0.5">{rec.text}</p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Quick Concept Mastery Snapshot */}
        <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm">
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-bold text-slate-900">Concept Mastery</h2>
            <Link to={`/projects/${projectId}/mastery`} className="text-xs font-medium text-blue-600 hover:underline">
              View All
            </Link>
          </div>

          {mastery.length === 0 ? (
            <p className="text-xs text-slate-500 py-6 text-center">
              No concepts evaluated yet. Start by taking a quiz or chatting with the AI Tutor.
            </p>
          ) : (
            <div className="space-y-3">
              {mastery.slice(0, 4).map((item) => (
                <div key={item._id}>
                  <div className="flex justify-between text-xs font-medium mb-1">
                    <span className="text-slate-700">{item.concept}</span>
                    <span className="text-blue-600">{item.level}%</span>
                  </div>
                  <div className="w-full h-2 bg-slate-100 rounded-full overflow-hidden">
                    <div
                      className={`h-full rounded-full transition-all duration-500 ${
                        item.level >= 75 ? 'bg-emerald-500' : item.level >= 50 ? 'bg-blue-500' : 'bg-amber-500'
                      }`}
                      style={{ width: `${item.level}%` }}
                    />
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
