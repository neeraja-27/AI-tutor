import os
import uuid
import numpy as np
from typing import List, Dict, Any, Optional
import chromadb
from chromadb.config import Settings
from langchain_core.documents import Document

class VectorStore:
    """Manages document embeddings in a persistent ChromaDB vector store with tenant isolation"""
    
    def __init__(
        self,
        collection_name: str = "pdf_documents",
        persist_directory: str = "./data/vector_store"
    ):
        self.collection_name = collection_name
        self.persist_directory = persist_directory
        self.client = None
        self.collection = None
        self._initialize_store()

    def _initialize_store(self):
        """Initialize ChromaDB persistent client and collection"""
        try:
            os.makedirs(self.persist_directory, exist_ok=True)
            self.client = chromadb.PersistentClient(path=self.persist_directory)
            
            self.collection = self.client.get_or_create_collection(
                name=self.collection_name,
                metadata={
                    "hnsw:space": "cosine",
                    "description": "Multi-tenant PDF embeddings for AI Study Companion"
                }
            )
            print(f"Vector store initialized at {self.persist_directory}. Collection: {self.collection_name}")
            print(f"Total documents currently in collection: {self.collection.count()}")
        except Exception as e:
            print(f"Error initializing vector store: {e}")
            raise

    def add_documents(self, documents: List[Document], embeddings: np.ndarray) -> int:
        """
        Add documents and embeddings to ChromaDB with proper metadata
        """
        if len(documents) != len(embeddings):
            raise ValueError("Number of documents must match number of embeddings")
            
        if len(documents) == 0:
            return 0
        
        ids = []
        metadatas = []
        documents_text = []
        embeddings_list = []
        
        for i, (doc, embedding) in enumerate(zip(documents, embeddings)):
            doc_id = f"doc_{uuid.uuid4().hex[:12]}_{i}"
            ids.append(doc_id)
            
            # Clean and sanitize metadata for ChromaDB (no nested dicts, all strings/ints/floats)
            clean_meta = {}
            for k, v in doc.metadata.items():
                if isinstance(v, (str, int, float, bool)):
                    clean_meta[k] = v
                else:
                    clean_meta[k] = str(v)
            
            clean_meta['doc_index'] = i
            clean_meta['content_length'] = len(doc.page_content)
            metadatas.append(clean_meta)
            
            documents_text.append(doc.page_content)
            embeddings_list.append(embedding.tolist())
        
        self.collection.add(
            ids=ids,
            embeddings=embeddings_list,
            metadatas=metadatas,
            documents=documents_text
        )
        print(f"Successfully added {len(documents)} chunks to vector store.")
        return len(documents)

    def delete_material(self, project_id: str, material_id: str):
        """Delete all vectors for a specific material in a project"""
        try:
            self.collection.delete(
                where={
                    "$and": [
                        {"projectId": {"$eq": str(project_id)}},
                        {"materialId": {"$eq": str(material_id)}}
                    ]
                }
            )
            print(f"Deleted vectors for material {material_id} in project {project_id}")
        except Exception as e:
            print(f"Warning deleting material vectors: {e}")
