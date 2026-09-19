import React, { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import api from '../services/api';
import {
  TrendingUp,
  ArrowLeft,
  Sparkles,
  AlertTriangle,
  CheckCircle2,
  HelpCircle,
  BookOpen
} from 'lucide-react';

export default function MasteryPage() {
  const { projectId } = useParams();
  const [data, setData] = useState({ mastery: [], recommendations: [] });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchMastery();
  }, [projectId]);

  const fetchMastery = async () => {
    try {
      const res = await api.get(`/mastery/projects/${projectId}`);
      setData(res.data);
    } catch (err) {
      console.error('Failed to fetch mastery data:', err);
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

  const { mastery = [], recommendations = [] } = data;

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
        <h1 className="text-2xl font-bold text-slate-900">Concept Mastery & Growth Analysis</h1>
        <p className="text-slate-500 text-sm mt-1">
          Estimated concept mastery levels evolving continuously through your quiz attempts, assessments, and AI Tutor interactions.
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Concept Mastery Bars */}
        <div className="lg:col-span-2 bg-white border border-slate-200 rounded-2xl p-6 sm:p-8 shadow-sm">
          <div className="flex items-center justify-between mb-6">
            <h2 className="font-bold text-slate-900 text-lg">Tracked Concepts ({mastery.length})</h2>
          </div>

          {mastery.length === 0 ? (
            <div className="text-center py-12 text-slate-500 text-sm">
              No concepts recorded yet. Take adaptive quizzes or chat with the AI Tutor to generate mastery evidence.
            </div>
          ) : (
            <div className="space-y-6">
              {mastery.map((item) => (
                <div key={item._id} className="p-4 rounded-xl border border-slate-100 bg-slate-50/50">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-2">
                    <div>
                      <span className="font-semibold text-slate-900 text-sm">{item.concept}</span>
                      <span className="text-xs text-slate-400 ml-2">
                        Updated {new Date(item.updatedAt).toLocaleDateString()}
                      </span>
                    </div>

                    <div className="flex items-center gap-2">
                      {item.status === 'improving' && (
                        <span className="text-[11px] font-semibold px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200 flex items-center gap-1">
                          <CheckCircle2 className="w-3 h-3" /> Improving
                        </span>
                      )}
                      {item.status === 'requiring_attention' && (
                        <span className="text-[11px] font-semibold px-2 py-0.5 rounded-full bg-amber-50 text-amber-700 border border-amber-200 flex items-center gap-1">
                          <AlertTriangle className="w-3 h-3" /> Needs Attention
                        </span>
                      )}
                      <span className="font-bold text-slate-900 text-sm">{item.level}%</span>
                    </div>
                  </div>

                  {/* Visual Progress Bar */}
                  <div className="w-full h-3 bg-slate-200 rounded-full overflow-hidden">
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

        {/* Actionable Recommendations */}
        <div className="bg-white border border-slate-200 rounded-2xl p-6 sm:p-8 shadow-sm">
          <div className="flex items-center gap-2 mb-6">
            <Sparkles className="w-5 h-5 text-amber-500" />
            <h2 className="font-bold text-slate-900 text-lg">Recommendations</h2>
          </div>

          {recommendations.length === 0 ? (
            <div className="text-center py-12 text-slate-500 text-xs">
              No active learning recommendations. Keep learning to receive automated study nudges.
            </div>
          ) : (
            <div className="space-y-4">
              {recommendations.map((rec) => (
                <div key={rec._id} className="p-4 rounded-xl border border-blue-100 bg-blue-50/40">
                  <h4 className="font-semibold text-slate-900 text-sm">{rec.title}</h4>
                  <p className="text-xs text-slate-600 mt-1 leading-relaxed">{rec.text}</p>
                  <Link
                    to={`/projects/${projectId}/tutor`}
                    className="mt-3 inline-flex items-center gap-1 text-xs font-semibold text-blue-600 hover:underline"
                  >
                    <span>Ask Tutor for Revision Guidance</span>
                  </Link>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
