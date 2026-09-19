import React, { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import api from '../services/api';
import { BarChart3, ArrowLeft, Activity, Zap, Clock, BookOpen } from 'lucide-react';

export default function AnalyticsPage() {
  const { projectId } = useParams();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchAnalytics();
  }, [projectId]);

  const fetchAnalytics = async () => {
    try {
      const res = await api.get(`/analytics/projects/${projectId}`);
      setData(res.data);
    } catch (err) {
      console.error('Failed to fetch analytics:', err);
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

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <div className="mb-6">
        <Link
          to={`/projects/${projectId}`}
          className="inline-flex items-center gap-1.5 text-sm font-medium text-slate-500 hover:text-slate-800 transition"
        >
          <ArrowLeft className="w-4 h-4" />
          <span>Back to Project Dashboard</span>
        </Link>
      </div>

      <div className="mb-8">
        <h1 className="text-2xl font-bold text-slate-900">Project Learning Analytics</h1>
        <p className="text-slate-500 text-sm mt-1">
          Measurable learning activity, quiz attempts, and AI interaction telemetry.
        </p>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5 mb-8">
        <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-sm">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center">
              <Activity className="w-5 h-5" />
            </div>
            <div>
              <p className="text-xs text-slate-500">Quiz Attempts</p>
              <p className="text-xl font-bold text-slate-900">{data?.quizAttemptsCount || 0}</p>
            </div>
          </div>
        </div>

        <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-sm">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center">
              <BookOpen className="w-5 h-5" />
            </div>
            <div>
              <p className="text-xs text-slate-500">Materials Ingested</p>
              <p className="text-xl font-bold text-slate-900">{data?.materialsCount || 0}</p>
            </div>
          </div>
        </div>

        <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-sm">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-indigo-50 text-indigo-600 flex items-center justify-center">
              <Zap className="w-5 h-5" />
            </div>
            <div>
              <p className="text-xs text-slate-500">AI Queries</p>
              <p className="text-xl font-bold text-slate-900">{data?.aiStats?.totalQueries || 0}</p>
            </div>
          </div>
        </div>

        <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-sm">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-amber-50 text-amber-600 flex items-center justify-center">
              <Clock className="w-5 h-5" />
            </div>
            <div>
              <p className="text-xs text-slate-500">Avg AI Latency</p>
              <p className="text-xl font-bold text-slate-900">{data?.aiStats?.avgLatencyMs || 0} ms</p>
            </div>
          </div>
        </div>
      </div>

      {/* Recent Quiz Attempts */}
      <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm mb-8">
        <h2 className="font-bold text-slate-900 mb-4 text-base">Recent Quiz Performance</h2>
        {data?.recentAttempts?.length === 0 ? (
          <p className="text-xs text-slate-500 py-6 text-center">No quiz history available yet.</p>
        ) : (
          <div className="divide-y divide-slate-100">
            {data.recentAttempts.map((att) => (
              <div key={att._id} className="py-3 flex items-center justify-between text-sm">
                <div>
                  <span className="font-medium text-slate-800">Attempt on {new Date(att.takenAt).toLocaleDateString()}</span>
                  <span className="text-xs text-slate-400 ml-2">({att.totalQuestions} questions)</span>
                </div>
                <span className={`font-bold px-2.5 py-1 rounded-full text-xs ${
                  att.score >= 75 ? 'bg-emerald-50 text-emerald-700' : 'bg-amber-50 text-amber-700'
                }`}>
                  {att.score}%
                </span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
