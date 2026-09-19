import os
from dotenv import load_dotenv
load_dotenv()

from fastapi import FastAPI, HTTPException, BackgroundTasks
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field
from typing import List, Optional, Dict, Any

from rag.loader import load_single_pdf
from rag.splitter import split_documents
from rag.embeddings import EmbeddingManager
from rag.vector_store import VectorStore
from rag.retriever import RAGRetriever
from rag.pipeline import AdvancedRAGPipeline

app = FastAPI(
    title="AI Study Companion - RAG & Vector Engine",
    version="1.0.0",
    description="Python FastAPI service providing RAG, ChromaDB persistence, and Groq LLM integration"
)

# Enable CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Global instances initialized on startup
EMBEDDING_MODEL = os.getenv("EMBEDDING_MODEL", "all-MiniLM-L6-v2")
CHROMA_PERSIST_DIR = os.getenv("CHROMA_PERSIST_DIR", "./data/vector_store")
GROQ_MODEL = os.getenv("GROQ_MODEL", "openai/gpt-oss-20b")

print("Initializing RAG core modules...")
embedding_manager = EmbeddingManager(model_name=EMBEDDING_MODEL)
vector_store = VectorStore(persist_directory=CHROMA_PERSIST_DIR)
retriever = RAGRetriever(vector_store=vector_store, embedding_manager=embedding_manager)
rag_pipeline = AdvancedRAGPipeline(retriever=retriever, model_name=GROQ_MODEL)
print("RAG core modules ready!")


# --- Request & Response Models ---
class IngestRequest(BaseModel):
    file_path: str
    project_id: str
    material_id: str
    filename: Optional[str] = None
    chunk_size: int = 1000
    chunk_overlap: int = 200

class QueryRequest(BaseModel):
    question: str
    project_id: str
    top_k: int = 5
    min_score: float = 0.2
    history: Optional[List[Dict[str, str]]] = None

class SourceItem(BaseModel):
    source: str
    page: Any
    score: float
    preview: str

class QueryResponse(BaseModel):
    answer: str
    sources: List[SourceItem]
    citations: List[str]
    confidence: float
    latency_ms: int
    tokens_used: int = 0
    model: str
    evidence_found: bool


# --- Endpoints ---
@app.get("/health")
def health_check():
    return {
        "status": "healthy",
        "service": "rag-service",
        "embedding_model": EMBEDDING_MODEL,
        "chroma_dir": CHROMA_PERSIST_DIR,
        "total_documents": vector_store.collection.count()
    }


@app.post("/rag/ingest")
def ingest_document(req: IngestRequest):
    """
    Ingest a PDF file: load pages, split into chunks, compute embeddings, and store in ChromaDB with projectId metadata.
    """
    try:
        # 1. Load document
        documents = load_single_pdf(
            file_path=req.file_path,
            project_id=req.project_id,
            material_id=req.material_id,
            original_filename=req.filename
        )
        
        # 2. Split chunks
        chunks = split_documents(
            documents,
            chunk_size=req.chunk_size,
            chunk_overlap=req.chunk_overlap
        )
        
        # 3. Generate embeddings
        texts = [chunk.page_content for chunk in chunks]
        embeddings = embedding_manager.generate_embeddings(texts)
        
        # 4. Upsert to Vector Store
        count = vector_store.add_documents(chunks, embeddings)
        
        return {
            "success": True,
            "message": f"Successfully ingested {count} chunks",
            "chunks_count": count,
            "project_id": req.project_id,
            "material_id": req.material_id
        }
    except Exception as e:
        print(f"Ingestion failed: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/rag/query", response_model=QueryResponse)
def query_rag(req: QueryRequest):
    """
    Retrieve project-scoped context and generate grounded tutor response with page citations.
    """
    try:
        res = rag_pipeline.query(
            question=req.question,
            project_id=req.project_id,
            top_k=req.top_k,
            min_score=req.min_score,
            history=req.history
        )
        return res
    except Exception as e:
        print(f"Query execution failed: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@app.delete("/rag/projects/{project_id}/materials/{material_id}")
def delete_material_vectors(project_id: str, material_id: str):
    """
    Delete all vector embeddings associated with a deleted material.
    """
    try:
        vector_store.delete_material(project_id, material_id)
        return {"success": True, "message": "Material vectors removed"}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


if __name__ == "__main__":
    import uvicorn
    port = int(os.getenv("RAG_PORT", 8000))
    uvicorn.run("main:app", host="0.0.0.0", port=port, reload=True)
