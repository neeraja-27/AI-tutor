import React from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext';
import Navbar from './components/Navbar';
import ProtectedRoute from './components/ProtectedRoute';

import Login from './pages/Login';
import Register from './pages/Register';
import Spaces from './pages/Spaces';
import Projects from './pages/Projects';
import ProjectDashboard from './pages/ProjectDashboard';
import Materials from './pages/Materials';
import TutorChat from './pages/TutorChat';
import QuizPage from './pages/QuizPage';
import MasteryPage from './pages/MasteryPage';
import AnalyticsPage from './pages/AnalyticsPage';
import AdminDashboard from './pages/AdminDashboard';

function RootRedirect() {
  const { user, loading } = useAuth();
  if (loading) return null;
  return user ? <Navigate to="/spaces" replace /> : <Navigate to="/login" replace />;
}

export default function App() {
  return (
    <AuthProvider>
      <Router>
        <div className="min-h-screen flex flex-col bg-slate-50 text-slate-900">
          <Navbar />
          <main className="flex-1">
            <Routes>
              {/* Public Routes */}
              <Route path="/" element={<RootRedirect />} />
              <Route path="/login" element={<Login />} />
              <Route path="/register" element={<Register />} />

              {/* Protected User Routes */}
              <Route element={<ProtectedRoute />}>
                <Route path="/spaces" element={<Spaces />} />
                <Route path="/spaces/:spaceId/projects" element={<Projects />} />
                <Route path="/projects/:projectId" element={<ProjectDashboard />} />
                <Route path="/projects/:projectId/materials" element={<Materials />} />
                <Route path="/projects/:projectId/tutor" element={<TutorChat />} />
                <Route path="/projects/:projectId/quizzes" element={<QuizPage />} />
                <Route path="/projects/:projectId/mastery" element={<MasteryPage />} />
                <Route path="/projects/:projectId/analytics" element={<AnalyticsPage />} />
              </Route>

              {/* Protected Admin Routes */}
              <Route element={<ProtectedRoute requireAdmin={true} />}>
                <Route path="/admin" element={<AdminDashboard />} />
              </Route>

              {/* Catch-all */}
              <Route path="*" element={<Navigate to="/" replace />} />
            </Routes>
          </main>
        </div>
      </Router>
    </AuthProvider>
  );
}
