const axios = require('axios');

const RAG_BASE_URL = process.env.RAG_SERVICE_URL || 'http://localhost:8000';

const ragService = {
  // Ingest uploaded PDF file
  async ingestDocument({ filePath, projectId, materialId, filename }) {
    try {
      const response = await axios.post(`${RAG_BASE_URL}/rag/ingest`, {
        file_path: filePath,
        project_id: projectId.toString(),
        material_id: materialId.toString(),
        filename: filename,
      });
      return response.data;
    } catch (error) {
      console.error('RAG Ingestion Service Error:', error.response?.data || error.message);
      throw new Error(error.response?.data?.detail || 'Failed to communicate with RAG ingest service');
    }
  },

  // Query Grounded AI Tutor
  async queryTutor({ question, projectId, topK = 5, minScore = 0.2, history = [] }) {
    try {
      const response = await axios.post(`${RAG_BASE_URL}/rag/query`, {
        question,
        project_id: projectId.toString(),
        top_k: topK,
        min_score: minScore,
        history,
      });
      return response.data;
    } catch (error) {
      console.error('RAG Query Service Error:', error.response?.data || error.message);
      throw new Error(error.response?.data?.detail || 'Failed to query RAG tutor service');
    }
  },

  // Generate a question paper from indexed project materials and render it to PDF
  async generateQuestionPaper({
    projectId,
    title,
    subject,
    topic,
    durationMinutes,
    mcqCount,
    shortCount,
    longCount,
    difficulty,
    includeAnswerKey,
  }) {
    try {
      const response = await axios.post(
        `${RAG_BASE_URL}/papers/generate`,
        {
          project_id: projectId.toString(),
          title,
          subject,
          topic,
          duration_minutes: durationMinutes,
          mcq_count: mcqCount,
          short_count: shortCount,
          long_count: longCount,
          difficulty,
          include_answer_key: includeAnswerKey,
        },
        { timeout: 120000 }
      );
      return response.data;
    } catch (error) {
      console.error('Question paper service error:', error.response?.data || error.message);
      const detail = error.response?.data?.detail;
      const wrapped = new Error(
        (typeof detail === 'string' && detail) ||
          (error.code === 'ECONNREFUSED'
            ? 'Question paper service is unavailable. Make sure the Python service is running.'
            : 'Failed to generate the question paper.')
      );
      wrapped.statusCode = error.response?.status || (error.code === 'ECONNREFUSED' ? 503 : 502);
      throw wrapped;
    }
  },

  // Delete Material Vectors
  async deleteMaterialVectors({ projectId, materialId }) {
    try {
      const response = await axios.delete(
        `${RAG_BASE_URL}/rag/projects/${projectId}/materials/${materialId}`
      );
      return response.data;
    } catch (error) {
      console.error('RAG Vector Deletion Error:', error.message);
      return { success: false };
    }
  },
};

module.exports = ragService;
