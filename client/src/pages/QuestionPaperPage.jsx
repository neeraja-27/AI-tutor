import React, { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import api from '../services/api';
import {
  ArrowLeft,
  ScrollText,
  Download,
  Trash2,
  AlertCircle,
  Eye,
  EyeOff,
} from 'lucide-react';

const inputClass =
  'w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:ring-2 focus:ring-amber-500 focus:outline-none bg-white';

function uniqueSources(sources) {
  const names = [];
  (sources || []).forEach((item) => {
    const name = item?.source;
    if (name && !names.includes(name)) names.push(name);
  });
  return names;
}

export default function QuestionPaperPage() {
  const { projectId } = useParams();
  const [loading, setLoading] = useState(true);
  const [projectName, setProjectName] = useState('');
  const [readyCount, setReadyCount] = useState(0);
  const [papers, setPapers] = useState([]);
  const [activeId, setActiveId] = useState(null);
  const [generating, setGenerating] = useState(false);
  const [downloadingId, setDownloadingId] = useState(null);
  const [error, setError] = useState('');
  const [showAnswers, setShowAnswers] = useState(false);

  const [title, setTitle] = useState('');
  const [subject, setSubject] = useState('');
  const [topic, setTopic] = useState('');
  const [durationMinutes, setDurationMinutes] = useState(90);
  const [mcqCount, setMcqCount] = useState(5);
  const [shortCount, setShortCount] = useState(3);
  const [longCount, setLongCount] = useState(2);
  const [difficulty, setDifficulty] = useState('mixed');
  const [includeAnswerKey, setIncludeAnswerKey] = useState(false);

  useEffect(() => {
    loadPage();
  }, [projectId]);

  const loadPage = async () => {
    setLoading(true);
    try {
      const [projectRes, papersRes] = await Promise.all([
        api.get(`/projects/${projectId}`),
        api.get(`/papers/projects/${projectId}`),
      ]);
      const name = projectRes.data?.project?.name || '';
      const materials = projectRes.data?.materials || [];
      setProjectName(name);
      setReadyCount(materials.filter((item) => item.status === 'ready').length);
      setTitle((current) => current || (name ? `${name} Question Paper` : ''));
      setSubject((current) => current || name);
      const list = papersRes.data || [];
      setPapers(list);
      setActiveId((current) => current || list[0]?._id || null);
    } catch (err) {
      console.error('Failed to load question papers:', err);
      setError(err.response?.data?.message || 'Could not load question papers.');
    } finally {
      setLoading(false);
    }
  };

  const activePaper = papers.find((paper) => paper._id === activeId) || null;

  const handleGenerate = async (event) => {
    event.preventDefault();
    const total = Number(mcqCount) + Number(shortCount) + Number(longCount);
    if (total < 1) {
      setError('Choose at least one question.');
      return;
    }
    setGenerating(true);
    setError('');
    try {
      const res = await api.post(`/papers/projects/${projectId}/generate`, {
        title: title.trim() || `${projectName || 'Project'} Question Paper`,
        subject: subject.trim(),
        topic: topic.trim(),
        durationMinutes: Number(durationMinutes) || 90,
        mcqCount: Number(mcqCount) || 0,
        shortCount: Number(shortCount) || 0,
        longCount: Number(longCount) || 0,
        difficulty,
        includeAnswerKey,
      });
      setPapers((current) => [res.data, ...current.filter((paper) => paper._id !== res.data._id)]);
      setActiveId(res.data._id);
      setShowAnswers(false);
    } catch (err) {
      setError(err.response?.data?.message || 'Could not generate the question paper.');
    } finally {
      setGenerating(false);
    }
  };

  const downloadPaper = async (paper) => {
    setDownloadingId(paper._id);
    setError('');
    try {
      const res = await api.get(`/papers/${paper._id}/pdf`, { responseType: 'blob' });
      const blob = new Blob([res.data], { type: 'application/pdf' });
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `${(paper.title || 'question-paper').replace(/[^\w\s-]+/g, '').trim() || 'question-paper'}.pdf`;
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);
    } catch (err) {
      let message = 'Could not download the PDF.';
      const data = err.response?.data;
      if (data instanceof Blob) {
        try {
          message = JSON.parse(await data.text()).message || message;
        } catch {
          message = 'Could not download the PDF.';
        }
      } else if (data?.message) {
        message = data.message;
      }
      setError(message);
    } finally {
      setDownloadingId(null);
    }
  };

  const deletePaper = async (paper) => {
    if (!window.confirm(`Delete "${paper.title}"?`)) return;
    try {
      await api.delete(`/papers/${paper._id}`);
      const remaining = papers.filter((item) => item._id !== paper._id);
      setPapers(remaining);
      if (activeId === paper._id) setActiveId(remaining[0]?._id || null);
    } catch (err) {
      setError(err.response?.data?.message || 'Could not delete the question paper.');
    }
  };

  if (loading) {
    return (
      <div className="min-h-[60vh] flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-amber-600"></div>
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
        <h1 className="text-2xl font-bold text-slate-900">Question Paper Generator</h1>
        <p className="text-slate-500 text-sm mt-1 max-w-3xl">
          Questions are written from this project's indexed PDFs. Python then lays them out as an exam PDF you can download.
        </p>
      </div>

      {readyCount === 0 && (
        <div className="mb-6 p-4 bg-amber-50 border border-amber-200 rounded-xl text-sm text-amber-800 flex items-start gap-2">
          <AlertCircle className="w-4 h-4 mt-0.5 shrink-0" />
          <p>
            No study material is ready yet.{' '}
            <Link to={`/projects/${projectId}/materials`} className="font-semibold underline">
              Upload a PDF
            </Link>{' '}
            and wait until it finishes indexing before generating a paper.
          </p>
        </div>
      )}

      {error && (
        <div className="mb-6 p-3 bg-red-50 border border-red-200 text-red-700 text-sm rounded-xl flex items-start gap-2">
          <AlertCircle className="w-4 h-4 mt-0.5 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-5 gap-8">
        <form
          onSubmit={handleGenerate}
          className="lg:col-span-2 bg-white border border-slate-200 rounded-2xl p-6 shadow-sm h-fit"
        >
          <div className="flex items-center gap-2 mb-4">
            <div className="w-9 h-9 rounded-lg bg-amber-50 text-amber-600 flex items-center justify-center">
              <ScrollText className="w-4 h-4" />
            </div>
            <h2 className="font-bold text-slate-900">Paper setup</h2>
          </div>

          <div className="space-y-4">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Title</label>
              <input
                className={inputClass}
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                maxLength={140}
                placeholder="Mid Semester Question Paper"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Subject</label>
              <input
                className={inputClass}
                value={subject}
                onChange={(e) => setSubject(e.target.value)}
                maxLength={80}
                placeholder="Operating Systems"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Topic focus</label>
              <input
                className={inputClass}
                value={topic}
                onChange={(e) => setTopic(e.target.value)}
                maxLength={200}
                placeholder="Leave blank to cover the materials broadly"
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Duration (minutes)</label>
                <input
                  type="number"
                  min={15}
                  max={180}
                  className={inputClass}
                  value={durationMinutes}
                  onChange={(e) => setDurationMinutes(e.target.value)}
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Difficulty</label>
                <select
                  className={inputClass}
                  value={difficulty}
                  onChange={(e) => setDifficulty(e.target.value)}
                >
                  <option value="mixed">Mixed</option>
                  <option value="easy">Easy</option>
                  <option value="medium">Medium</option>
                  <option value="hard">Hard</option>
                </select>
              </div>
            </div>

            <div className="grid grid-cols-3 gap-3">
              <CountField label="MCQ · 1 mark" value={mcqCount} max={12} onChange={setMcqCount} />
              <CountField label="Short · 5 marks" value={shortCount} max={6} onChange={setShortCount} />
              <CountField label="Long · 10 marks" value={longCount} max={4} onChange={setLongCount} />
            </div>

            <label className="flex items-start gap-2 text-sm text-slate-700">
              <input
                type="checkbox"
                className="mt-1"
                checked={includeAnswerKey}
                onChange={(e) => setIncludeAnswerKey(e.target.checked)}
              />
              <span>
                Append an answer key to the PDF.
                <span className="block text-xs text-slate-500 mt-0.5">
                  Leave this off when the file will be given to students. Answers stay available on this page either way.
                </span>
              </span>
            </label>

            <button
              type="submit"
              disabled={generating || readyCount === 0}
              className="w-full inline-flex items-center justify-center gap-2 px-4 py-2.5 bg-amber-600 hover:bg-amber-700 text-white text-sm font-medium rounded-xl shadow-sm transition disabled:opacity-50"
            >
              {generating ? 'Writing questions and building the PDF...' : 'Generate question paper'}
            </button>
            {generating && (
              <p className="text-xs text-slate-500 text-center">
                This reads the indexed material, drafts the questions, and renders the PDF. It can take up to a minute.
              </p>
            )}
          </div>
        </form>

        <div className="lg:col-span-3">
          {!activePaper ? (
            <div className="bg-white border border-slate-200 rounded-2xl p-10 text-center shadow-sm">
              <div className="w-12 h-12 rounded-xl bg-amber-50 text-amber-600 flex items-center justify-center mx-auto mb-3">
                <ScrollText className="w-6 h-6" />
              </div>
              <h2 className="font-semibold text-slate-900">No question paper yet</h2>
              <p className="text-sm text-slate-500 mt-1 max-w-md mx-auto">
                Set the counts and generate a paper. The questions appear here, and the PDF is ready to download.
              </p>
            </div>
          ) : (
            <PaperPreview
              paper={activePaper}
              showAnswers={showAnswers}
              onToggleAnswers={() => setShowAnswers((value) => !value)}
              onDownload={() => downloadPaper(activePaper)}
              downloading={downloadingId === activePaper._id}
            />
          )}
        </div>
      </div>

      {papers.length > 0 && (
        <div className="mt-8 bg-white border border-slate-200 rounded-2xl overflow-hidden shadow-sm">
          <div className="px-6 py-4 border-b border-slate-200 font-semibold text-slate-900 text-sm">
            Generated papers ({papers.length})
          </div>
          <div className="divide-y divide-slate-200">
            {papers.map((paper) => (
              <div key={paper._id} className="px-6 py-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <button
                  type="button"
                  onClick={() => {
                    setActiveId(paper._id);
                    setShowAnswers(false);
                  }}
                  className="text-left"
                >
                  <h3 className={`text-sm font-semibold ${paper._id === activeId ? 'text-amber-700' : 'text-slate-900'}`}>
                    {paper.title}
                  </h3>
                  <p className="text-xs text-slate-500 mt-0.5">
                    {paper.questionCount} questions · {paper.totalMarks} marks · {paper.durationMinutes} min ·{' '}
                    {new Date(paper.createdAt).toLocaleString()}
                  </p>
                </button>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => downloadPaper(paper)}
                    disabled={downloadingId === paper._id}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-lg transition disabled:opacity-50"
                  >
                    <Download className="w-3.5 h-3.5" />
                    {downloadingId === paper._id ? 'Downloading...' : 'PDF'}
                  </button>
                  <button
                    type="button"
                    onClick={() => deletePaper(paper)}
                    className="p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition"
                    title="Delete question paper"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function CountField({ label, value, max, onChange }) {
  return (
    <div>
      <label className="block text-xs font-semibold text-slate-700 mb-1">{label}</label>
      <input
        type="number"
        min={0}
        max={max}
        className={inputClass}
        value={value}
        onChange={(e) => onChange(e.target.value)}
      />
    </div>
  );
}

function PaperPreview({ paper, showAnswers, onToggleAnswers, onDownload, downloading }) {
  const sources = uniqueSources(paper.sources);
  return (
    <div className="bg-white border border-slate-200 rounded-2xl shadow-sm overflow-hidden">
      <div className="px-6 py-5 border-b border-slate-200 flex flex-col sm:flex-row sm:items-start justify-between gap-4">
        <div>
          <p className="text-[11px] font-semibold tracking-wide text-amber-700 uppercase">Question paper</p>
          <h2 className="text-lg font-bold text-slate-900 mt-1">{paper.title}</h2>
          <p className="text-xs text-slate-500 mt-1">
            {paper.subject ? `${paper.subject} · ` : ''}
            {paper.durationMinutes} minutes · {paper.totalMarks} marks · {paper.difficulty}
          </p>
          {sources.length > 0 && (
            <p className="text-xs text-slate-500 mt-1">Grounded in {sources.join(', ')}</p>
          )}
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={onToggleAnswers}
            className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-medium text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-lg transition"
          >
            {showAnswers ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
            {showAnswers ? 'Hide answers' : 'Show answers'}
          </button>
          <button
            type="button"
            onClick={onDownload}
            disabled={downloading}
            className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-medium text-white bg-amber-600 hover:bg-amber-700 rounded-lg transition disabled:opacity-50"
          >
            <Download className="w-3.5 h-3.5" />
            {downloading ? 'Downloading...' : 'Download PDF'}
          </button>
        </div>
      </div>

      <div className="px-6 py-5 space-y-6">
        {paper.instructions?.length > 0 && (
          <div>
            <h3 className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-2">Instructions</h3>
            <ol className="list-decimal list-inside text-sm text-slate-700 space-y-1">
              {paper.instructions.map((item, index) => (
                <li key={index}>{item}</li>
              ))}
            </ol>
          </div>
        )}

        {(paper.sections || []).map((section) => {
          const each = section.marksEach || section.questions?.[0]?.marks || 0;
          const count = section.questions?.length || 0;
          return (
            <div key={`${section.id}-${section.title}`}>
              <div className="mb-3">
                <h3 className="font-semibold text-slate-900">
                  Section {section.id} — {section.title}
                </h3>
                <p className="text-xs text-slate-500">
                  {count} × {each} = {count * each} marks
                </p>
              </div>
              <div className="space-y-4">
                {(section.questions || []).map((question) => (
                  <div key={question.number} className="text-sm text-slate-800">
                    <div className="flex items-start gap-3">
                      <p className="flex-1">
                        <span className="font-semibold">{question.number}. </span>
                        {question.prompt}
                      </p>
                      <span className="text-xs font-semibold text-slate-500 shrink-0">[{question.marks}]</span>
                    </div>
                    {question.options?.length > 0 && (
                      <ul className="mt-2 ml-5 space-y-1 text-slate-700">
                        {question.options.map((option, index) => (
                          <li key={index}>
                            ({String.fromCharCode(65 + index)}) {option}
                          </li>
                        ))}
                      </ul>
                    )}
                    {question.parts?.length > 0 && (
                      <ul className="mt-2 ml-5 space-y-1 text-slate-700">
                        {question.parts.map((part, index) => (
                          <li key={index}>
                            ({String.fromCharCode(97 + index)}) {part}
                          </li>
                        ))}
                      </ul>
                    )}
                    {showAnswers && (
                      <div className="mt-2 ml-5 rounded-lg bg-emerald-50 border border-emerald-100 px-3 py-2 text-xs text-emerald-900">
                        <p>
                          <span className="font-semibold">Answer: </span>
                          {question.answer || '—'}
                        </p>
                        {question.explanation && <p className="mt-1 text-emerald-800">{question.explanation}</p>}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
