import numpy as np
from typing import List, Dict, Any, Optional
from .vector_store import VectorStore
from .embeddings import EmbeddingManager

class RAGRetriever:
    """Handles query-based retrieval from the vector store with project isolation"""
    
    def __init__(self, vector_store: VectorStore, embedding_manager: EmbeddingManager):
        self.vector_store = vector_store
        self.embedding_manager = embedding_manager

    def retrieve(
        self,
        query: str,
        project_id: Optional[str] = None,
        top_k: int = 5,
        score_threshold: float = 0.0
    ) -> List[Dict[str, Any]]:
        """
        Retrieve relevant chunks for a query filtered strictly by project_id
        """
        print(f"Retrieving for query: '{query}' | Project: {project_id} | Top K: {top_k}")
        
        # Generate query embedding
        query_embedding = self.embedding_manager.generate_embeddings([query])[0]
        
        # Build multi-tenant filter if project_id is provided
        where_filter = None
        if project_id:
            where_filter = {"projectId": {"$eq": str(project_id)}}
            
        try:
            results = self.vector_store.collection.query(
                query_embeddings=[query_embedding.tolist()],
                n_results=top_k,
                where=where_filter
            )
            
            retrieved_docs = []
            if results['documents'] and results['documents'][0]:
                documents = results['documents'][0]
                metadatas = results['metadatas'][0]
                distances = results['distances'][0]
                ids = results['ids'][0]
                
                # Detect Chroma distance metric ('l2' by default, or 'cosine')
                space = "l2"
                if hasattr(self.vector_store, "collection") and self.vector_store.collection:
                    meta = self.vector_store.collection.metadata or {}
                    space = meta.get("hnsw:space", "l2")

                for i, (doc_id, document, metadata, distance) in enumerate(zip(ids, documents, metadatas, distances)):
                    dist_val = float(distance)
                    if space == "cosine":
                        # Chroma cosine space: distance = 1 - cosine_similarity (range [0, 2])
                        sim = 1.0 - dist_val
                    else:
                        # Chroma l2 space: distance = squared Euclidean norm = 2 - 2 * cosine_similarity
                        # For normalized embeddings: cosine_similarity = 1 - (squared_l2 / 2)
                        sim = 1.0 - (dist_val / 2.0)

                    similarity_score = round(max(0.0, min(1.0, sim)), 4)
                    
                    if similarity_score >= score_threshold:
                        retrieved_docs.append({
                            'id': doc_id,
                            'content': document,
                            'metadata': metadata,
                            'similarity_score': similarity_score,
                            'distance': dist_val,
                            'rank': i + 1
                        })
                        
                print(f"Retrieved {len(retrieved_docs)}/{len(documents)} chunks after threshold filter ({score_threshold}) [space: {space}]")
                if retrieved_docs:
                    top_scores = [d['similarity_score'] for d in retrieved_docs[:3]]
                    print(f"  Top chunk scores: {top_scores}")
                elif documents:
                    raw_scores = []
                    for d in distances[:3]:
                        raw_sim = 1.0 - float(d) if space == "cosine" else 1.0 - (float(d) / 2.0)
                        raw_scores.append(round(max(0.0, min(1.0, raw_sim)), 4))
                    print(f"  Top raw scores before filter: {raw_scores} (required >= {score_threshold})")
            else:
                print("No matching chunks found in vector store.")
                
            return retrieved_docs
            
        except Exception as e:
            print(f"Error during retrieval: {e}")
            return []
