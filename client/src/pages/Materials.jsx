import React, { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import api from '../services/api';
import {
  UploadCloud,
  FileText,
  CheckCircle2,
  Clock,
  AlertCircle,
  Trash2,
  ArrowLeft,
  RefreshCw
} from 'lucide-react';

export default function Materials() {
  const { projectId } = useParams();
  const [materials, setMaterials] = useState([]);
  const [loading, setLoading] = useState(true);
  const [file, setFile] = useState(null);
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState('');

  useEffect(() => {
    fetchMaterials();
    // Poll every 5s if any material is in queued or processing status
    const interval = setInterval(() => {
      setMaterials((prev) => {
        const hasPending = prev.some((m) => m.status === 'queued' || m.status === 'processing');
        if (hasPending) fetchMaterials();
        return prev;
      });
    }, 5000);

    return () => clearInterval(interval);
  }, [projectId]);

  const fetchMaterials = async () => {
    try {
      const res = await api.get(`/projects/${projectId}`);
      setMaterials(res.data.materials || []);
    } catch (err) {
      console.error('Error fetching materials:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleUpload = async (e) => {
    e.preventDefault();
    if (!file) return;

    if (file.type !== 'application/pdf') {
      setUploadError('Only PDF files are supported.');
      return;
    }

    setUploading(true);
    setUploadError('');

    const formData = new FormData();
    formData.append('file', file);

    try {
      await api.post(`/materials/projects/${projectId}`, formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      setFile(null);
      await fetchMaterials();
    } catch (err) {
      setUploadError(err.response?.data?.message || 'Failed to upload PDF');
    } finally {
      setUploading(false);
    }
  };

  const handleDelete = async (materialId) => {
    if (!window.confirm('Delete this material and its vector embeddings?')) return;
    try {
      await api.delete(`/materials/${materialId}`);
      setMaterials(materials.filter((m) => m._id !== materialId));
    } catch (err) {
      console.error('Failed to delete material:', err);
    }
  };

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      {/* Back button */}
      <div className="mb-6">
        <Link
          to={`/projects/${projectId}`}
          className="inline-flex items-center gap-1.5 text-sm font-medium text-slate-500 hover:text-slate-800 transition"
        >
          <ArrowLeft className="w-4 h-4" />
          <span>Back to Project Dashboard</span>
        </Link>
      </div>

      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-8">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Learning Materials</h1>
          <p className="text-slate-500 text-sm mt-1">
            Upload PDF textbooks, lecture notes, or research papers to build your grounded knowledge base.
          </p>
        </div>
        <button
          onClick={fetchMaterials}
          className="p-2 text-slate-500 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition self-start"
          title="Refresh statuses"
        >
          <RefreshCw className="w-4 h-4" />
        </button>
      </div>

      {/* Upload Box */}
      <div className="bg-white border-2 border-dashed border-slate-300 hover:border-blue-500 rounded-2xl p-8 mb-8 transition text-center shadow-sm">
        <form onSubmit={handleUpload} className="max-w-md mx-auto">
          <div className="w-14 h-14 rounded-2xl bg-blue-50 text-blue-600 flex items-center justify-center mx-auto mb-3">
            <UploadCloud className="w-7 h-7" />
          </div>

          <h3 className="font-semibold text-slate-900 text-base mb-1">
            {file ? file.name : 'Upload PDF Document'}
          </h3>
          <p className="text-xs text-slate-500 mb-4">
            PDF documents will be automatically chunked, embedded, and indexed for AI Tutor citations.
          </p>

          {uploadError && (
            <div className="mb-4 p-2.5 bg-red-50 text-red-700 text-xs rounded-lg flex items-center justify-center gap-2">
              <AlertCircle className="w-4 h-4" />
              <span>{uploadError}</span>
            </div>
          )}

          <div className="flex items-center justify-center gap-3">
            <label className="cursor-pointer px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 text-sm font-medium rounded-lg transition">
              <span>{file ? 'Change PDF' : 'Select PDF'}</span>
              <input
                type="file"
                accept=".pdf"
                className="hidden"
                onChange={(e) => setFile(e.target.files[0])}
              />
            </label>

            {file && (
              <button
                type="submit"
                disabled={uploading}
                className="px-5 py-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium rounded-lg shadow-sm transition disabled:opacity-50"
              >
                {uploading ? 'Uploading & Queuing...' : 'Upload & Process'}
              </button>
            )}
          </div>
        </form>
      </div>

      {/* Uploaded Materials List */}
      <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden shadow-sm">
        <div className="px-6 py-4 border-b border-slate-200 font-semibold text-slate-900 text-sm">
          Uploaded Course Materials ({materials.length})
        </div>

        {materials.length === 0 ? (
          <div className="py-12 text-center text-slate-500 text-sm">
            No study materials uploaded for this project yet.
          </div>
        ) : (
          <div className="divide-y divide-slate-200">
            {materials.map((mat) => (
              <div key={mat._id} className="px-6 py-4 flex items-center justify-between gap-4 hover:bg-slate-50">
                <div className="flex items-center gap-3.5">
                  <div className="w-10 h-10 rounded-lg bg-red-50 text-red-600 flex items-center justify-center">
                    <FileText className="w-5 h-5" />
                  </div>
                  <div>
                    <h4 className="text-sm font-semibold text-slate-900">{mat.originalName}</h4>
                    <p className="text-xs text-slate-500 mt-0.5">
                      {mat.fileSize ? `${Math.round(mat.fileSize / 1024)} KB` : ''} • Uploaded{' '}
                      {new Date(mat.uploadedAt).toLocaleDateString()}
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-4">
                  {/* Status Badge */}
                  {mat.status === 'ready' && (
                    <span className="inline-flex items-center gap-1 text-xs font-semibold px-2.5 py-1 bg-emerald-50 text-emerald-700 rounded-full border border-emerald-200">
                      <CheckCircle2 className="w-3.5 h-3.5" /> Ready ({mat.chunkCount} Chunks)
                    </span>
                  )}
                  {mat.status === 'processing' && (
                    <span className="inline-flex items-center gap-1 text-xs font-semibold px-2.5 py-1 bg-blue-50 text-blue-700 rounded-full border border-blue-200 animate-pulse">
                      <Clock className="w-3.5 h-3.5" /> Processing...
                    </span>
                  )}
                  {mat.status === 'queued' && (
                    <span className="inline-flex items-center gap-1 text-xs font-semibold px-2.5 py-1 bg-amber-50 text-amber-700 rounded-full border border-amber-200">
                      <Clock className="w-3.5 h-3.5" /> Queued
                    </span>
                  )}
                  {mat.status === 'failed' && (
                    <span className="inline-flex items-center gap-1 text-xs font-semibold px-2.5 py-1 bg-red-50 text-red-700 rounded-full border border-red-200">
                      <AlertCircle className="w-3.5 h-3.5" /> Processing Failed
                    </span>
                  )}

                  <button
                    onClick={() => handleDelete(mat._id)}
                    className="p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition"
                    title="Delete document"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
