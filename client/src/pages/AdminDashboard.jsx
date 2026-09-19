import React, { useState, useEffect } from 'react';
import api from '../services/api';
import { Shield, Users, Layers, BookOpen, FileText, Activity, AlertTriangle, Clock } from 'lucide-react';

export default function AdminDashboard() {
  const [data, setData] = useState(null);
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchAdminData();
  }, []);

  const fetchAdminData = async () => {
    try {
      const [overviewRes, usersRes] = await Promise.all([
        api.get('/admin/overview'),
        api.get('/admin/users'),
      ]);
      setData(overviewRes.data);
      setUsers(usersRes.data);
    } catch (err) {
      console.error('Error fetching admin data:', err);
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

  const { metrics = {}, recentTraces = [] } = data || {};

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <div className="mb-8 flex items-center justify-between">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="px-2.5 py-0.5 rounded-full bg-amber-50 text-amber-700 border border-amber-200 text-xs font-semibold flex items-center gap-1">
              <Shield className="w-3.5 h-3.5" /> Platform Admin
            </span>
          </div>
          <h1 className="text-2xl font-bold text-slate-900">System & AI Observability Dashboard</h1>
          <p className="text-slate-500 text-sm mt-1">
            Real-time platform metrics, user journeys, background jobs, and AI telemetry.
          </p>
        </div>
      </div>

      {/* Global System Metrics */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4 mb-8">
        <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-sm">
          <p className="text-xs text-slate-500">Users</p>
          <p className="text-xl font-bold text-slate-900 mt-1">{metrics.totalUsers || 0}</p>
        </div>
        <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-sm">
          <p className="text-xs text-slate-500">Spaces</p>
          <p className="text-xl font-bold text-slate-900 mt-1">{metrics.totalSpaces || 0}</p>
        </div>
        <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-sm">
          <p className="text-xs text-slate-500">Projects</p>
          <p className="text-xl font-bold text-slate-900 mt-1">{metrics.totalProjects || 0}</p>
        </div>
        <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-sm">
          <p className="text-xs text-slate-500">Materials</p>
          <p className="text-xl font-bold text-slate-900 mt-1">{metrics.totalMaterials || 0}</p>
        </div>
        <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-sm">
          <p className="text-xs text-slate-500">AI Traces</p>
          <p className="text-xl font-bold text-blue-600 mt-1">{metrics.totalTraces || 0}</p>
        </div>
        <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-sm">
          <p className="text-xs text-slate-500">Failed Traces</p>
          <p className="text-xl font-bold text-red-600 mt-1">{metrics.failedTraces || 0}</p>
        </div>
      </div>

      {/* Observability Traces Table */}
      <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden shadow-sm mb-8">
        <div className="px-6 py-4 border-b border-slate-200 font-bold text-slate-900 text-sm flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Activity className="w-4 h-4 text-blue-600" />
            <span>Recent AI Observability Traces</span>
          </div>
          <span className="text-xs text-slate-400 font-normal">Last 20 operations</span>
        </div>

        {recentTraces.length === 0 ? (
          <div className="py-8 text-center text-slate-500 text-xs">No AI traces recorded yet.</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 text-slate-500 border-b border-slate-200">
                <tr>
                  <th className="px-4 py-3">Timestamp</th>
                  <th className="px-4 py-3">Feature</th>
                  <th className="px-4 py-3">Model</th>
                  <th className="px-4 py-3">Query</th>
                  <th className="px-4 py-3">Latency</th>
                  <th className="px-4 py-3">Chunks</th>
                  <th className="px-4 py-3">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {recentTraces.map((trace) => (
                  <tr key={trace._id} className="hover:bg-slate-50">
                    <td className="px-4 py-3 text-slate-500 whitespace-nowrap">
                      {new Date(trace.timestamp).toLocaleTimeString()}
                    </td>
                    <td className="px-4 py-3 font-medium text-slate-800">{trace.feature}</td>
                    <td className="px-4 py-3 text-slate-600 font-mono text-[11px]">{trace.model}</td>
                    <td className="px-4 py-3 text-slate-700 max-w-xs truncate">{trace.query}</td>
                    <td className="px-4 py-3 text-slate-600 font-mono">{trace.latencyMs}ms</td>
                    <td className="px-4 py-3 text-slate-600">{trace.retrievedCount}</td>
                    <td className="px-4 py-3">
                      {trace.success ? (
                        <span className="text-[10px] font-semibold px-2 py-0.5 bg-emerald-50 text-emerald-700 rounded-full border border-emerald-200">
                          SUCCESS
                        </span>
                      ) : (
                        <span className="text-[10px] font-semibold px-2 py-0.5 bg-red-50 text-red-700 rounded-full border border-red-200">
                          FAILED
                        </span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Users List */}
      <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden shadow-sm">
        <div className="px-6 py-4 border-b border-slate-200 font-bold text-slate-900 text-sm flex items-center gap-2">
          <Users className="w-4 h-4 text-blue-600" />
          <span>Registered Users ({users.length})</span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-50 text-slate-500 border-b border-slate-200">
              <tr>
                <th className="px-4 py-3">Name</th>
                <th className="px-4 py-3">Email</th>
                <th className="px-4 py-3">Role</th>
                <th className="px-4 py-3">Joined Date</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {users.map((u) => (
                <tr key={u._id} className="hover:bg-slate-50">
                  <td className="px-4 py-3 font-semibold text-slate-900">{u.name}</td>
                  <td className="px-4 py-3 text-slate-600">{u.email}</td>
                  <td className="px-4 py-3">
                    <span className={`px-2 py-0.5 rounded-full text-[10px] font-semibold ${
                      u.role === 'admin' ? 'bg-amber-100 text-amber-800' : 'bg-slate-100 text-slate-700'
                    }`}>
                      {u.role.toUpperCase()}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-slate-500">
                    {new Date(u.createdAt).toLocaleDateString()}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
