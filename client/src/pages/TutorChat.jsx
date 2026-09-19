import React, { useState, useEffect, useRef } from 'react';
import { useParams, Link } from 'react-router-dom';
import api from '../services/api';
import {
  Send,
  BookOpen,
  ArrowLeft,
  Sparkles,
  AlertCircle,
  FileText,
  CheckCircle2,
  Bot,
  User,
  ShieldAlert
} from 'lucide-react';

export default function TutorChat() {
  const { projectId } = useParams();
  const [project, setProject] = useState(null);
  const [conversation, setConversation] = useState(null);
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const messagesEndRef = useRef(null);

  useEffect(() => {
    fetchChatHistory();
  }, [projectId]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, sending]);

  const fetchChatHistory = async () => {
    try {
      const projRes = await api.get(`/projects/${projectId}`);
      setProject(projRes.data.project);

      const res = await api.get(`/tutor/projects/${projectId}/conversations`);
      setConversation(res.data.conversation);
      setMessages(res.data.messages || []);
    } catch (err) {
      console.error('Error fetching chat history:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleSendMessage = async (e) => {
    e.preventDefault();
    if (!input.trim() || sending) return;

    const userText = input.trim();
    setInput('');
    setSending(true);

    // Optimistic UI for user message
    const tempUserMsg = {
      _id: 'temp-' + Date.now(),
      sender: 'user',
      text: userText,
      timestamp: new Date(),
    };
    setMessages((prev) => [...prev, tempUserMsg]);

    try {
      const res = await api.post(`/tutor/projects/${projectId}/chat`, {
        question: userText,
        conversationId: conversation?._id,
      });

      // Replace with confirmed messages from backend
      setMessages((prev) => [
        ...prev.filter((m) => m._id !== tempUserMsg._id),
        res.data.userMessage,
        res.data.aiMessage,
      ]);
    } catch (err) {
      console.error('Failed to send message to AI Tutor:', err);
      setMessages((prev) => [
        ...prev,
        {
          _id: 'err-' + Date.now(),
          sender: 'ai',
          text: 'Sorry, I encountered an issue reaching the AI Tutor service. Please ensure the Python RAG service is running.',
          evidenceFound: false,
          timestamp: new Date(),
        },
      ]);
    } finally {
      setSending(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-[70vh] flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  return (
    <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-6 flex flex-col h-[calc(100vh-5rem)]">
      {/* Top Header */}
      <div className="flex items-center justify-between pb-4 border-b border-slate-200">
        <div className="flex items-center gap-3">
          <Link
            to={`/projects/${projectId}`}
            className="p-2 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-lg transition"
          >
            <ArrowLeft className="w-4 h-4" />
          </Link>
          <div>
            <h1 className="font-bold text-slate-900 text-lg flex items-center gap-2">
              <span>AI Study Tutor</span>
              <span className="text-xs px-2 py-0.5 rounded-full bg-blue-100 text-blue-700 font-medium">
                Grounded RAG
              </span>
            </h1>
            <p className="text-xs text-slate-500">
              Project: {project?.name || 'Workspace'}
            </p>
          </div>
        </div>

        <Link
          to={`/projects/${projectId}/materials`}
          className="text-xs font-medium text-blue-600 hover:underline flex items-center gap-1"
        >
          <FileText className="w-3.5 h-3.5" />
          <span>Manage Materials</span>
        </Link>
      </div>

      {/* Messages Scroll Area */}
      <div className="flex-1 overflow-y-auto py-6 space-y-6">
        {messages.length === 0 ? (
          <div className="text-center py-12 max-w-md mx-auto">
            <div className="w-12 h-12 bg-blue-50 text-blue-600 rounded-2xl flex items-center justify-center mx-auto mb-3 shadow-sm">
              <Sparkles className="w-6 h-6" />
            </div>
            <h3 className="font-semibold text-slate-900 text-base mb-1">
              Ask your AI Study Companion
            </h3>
            <p className="text-xs text-slate-500 mb-6">
              Ask conceptual questions, request simpler explanations, or test your understanding using your uploaded project materials.
            </p>
            <div className="space-y-2 text-left">
              {[
                'Explain the core concept in the uploaded material.',
                'Give me an intuitive real-world example.',
                'What are the key formulas or takeaways?'
              ].map((suggestion, idx) => (
                <button
                  key={idx}
                  onClick={() => setInput(suggestion)}
                  className="w-full text-xs text-slate-700 bg-white border border-slate-200 hover:border-blue-400 p-2.5 rounded-xl transition text-left shadow-2xs"
                >
                  💡 "{suggestion}"
                </button>
              ))}
            </div>
          </div>
        ) : (
          messages.map((msg) => (
            <div
              key={msg._id}
              className={`flex gap-3.5 ${msg.sender === 'user' ? 'justify-end' : 'justify-start'}`}
            >
              {msg.sender === 'ai' && (
                <div className="w-8 h-8 rounded-xl bg-blue-600 text-white flex items-center justify-center flex-shrink-0 mt-0.5 shadow-xs">
                  <Bot className="w-4 h-4" />
                </div>
              )}

              <div
                className={`max-w-2xl rounded-2xl p-4 text-sm ${
                  msg.sender === 'user'
                    ? 'bg-blue-600 text-white shadow-sm'
                    : 'bg-white border border-slate-200 text-slate-800 shadow-2xs'
                }`}
              >
                <div className="whitespace-pre-wrap leading-relaxed">{msg.text}</div>

                {/* Insufficient Evidence Notice */}
                {msg.sender === 'ai' && msg.evidenceFound === false && (
                  <div className="mt-3 p-2.5 bg-amber-50 border border-amber-200 rounded-xl text-xs text-amber-800 flex items-start gap-2">
                    <ShieldAlert className="w-4 h-4 flex-shrink-0 mt-0.5 text-amber-600" />
                    <span>
                      <strong>Notice:</strong> The AI could not find direct citations for this query in the uploaded materials.
                    </span>
                  </div>
                )}

                {/* Grounded Citations Badge / List */}
                {msg.sender === 'ai' && msg.citations && msg.citations.length > 0 && (
                  <div className="mt-4 pt-3 border-t border-slate-100">
                    <div className="text-xs font-semibold text-slate-500 mb-2 flex items-center gap-1.5">
                      <FileText className="w-3.5 h-3.5 text-blue-600" />
                      <span>Supporting Citations:</span>
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                      {msg.citations.map((cite, i) => (
                        <div
                          key={i}
                          className="bg-slate-50 border border-slate-200/80 p-2.5 rounded-lg text-xs"
                        >
                          <div className="font-semibold text-slate-800 truncate">
                            {cite.source || 'Document'}
                          </div>
                          <div className="text-blue-600 font-medium text-[11px]">
                            Page {cite.page || '1'} {cite.score ? `• ${Math.round(cite.score * 100)}% match` : ''}
                          </div>
                          {cite.preview && (
                            <p className="text-slate-500 line-clamp-2 text-[10px] mt-1 italic">
                              "{cite.preview}"
                            </p>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              {msg.sender === 'user' && (
                <div className="w-8 h-8 rounded-xl bg-slate-200 text-slate-700 flex items-center justify-center flex-shrink-0 mt-0.5">
                  <User className="w-4 h-4" />
                </div>
              )}
            </div>
          ))
        )}

        {sending && (
          <div className="flex gap-3.5 justify-start">
            <div className="w-8 h-8 rounded-xl bg-blue-600 text-white flex items-center justify-center flex-shrink-0 shadow-xs">
              <Bot className="w-4 h-4" />
            </div>
            <div className="bg-white border border-slate-200 rounded-2xl p-4 text-sm text-slate-500 flex items-center gap-2">
              <div className="animate-pulse flex space-x-1.5">
                <div className="w-2 h-2 bg-blue-600 rounded-full animate-bounce"></div>
                <div className="w-2 h-2 bg-blue-600 rounded-full animate-bounce [animation-delay:0.2s]"></div>
                <div className="w-2 h-2 bg-blue-600 rounded-full animate-bounce [animation-delay:0.4s]"></div>
              </div>
              <span className="text-xs">Searching materials & reasoning...</span>
            </div>
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* Input Bar */}
      <form onSubmit={handleSendMessage} className="pt-4 border-t border-slate-200 flex gap-2">
        <input
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="Ask a question about your project materials..."
          disabled={sending}
          className="flex-1 px-4 py-3 bg-white border border-slate-300 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition disabled:bg-slate-50"
        />
        <button
          type="submit"
          disabled={sending || !input.trim()}
          className="px-5 py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-xl font-medium text-sm transition shadow-sm disabled:opacity-50 flex items-center gap-1.5"
        >
          <Send className="w-4 h-4" />
          <span className="hidden sm:inline">Send</span>
        </button>
      </form>
    </div>
  );
}
