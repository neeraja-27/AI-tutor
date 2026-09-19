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
