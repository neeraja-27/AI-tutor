import os
import time
from typing import List, Dict, Any, Optional
from langchain_groq import ChatGroq
from langchain_core.messages import HumanMessage, SystemMessage
from .retriever import RAGRetriever

class AdvancedRAGPipeline:
    def __init__(
        self,
        retriever: RAGRetriever,
        model_name: str = "openai/gpt-oss-20b",
        api_key: Optional[str] = None
    ):
        self.retriever = retriever
        self.api_key = api_key or os.environ.get("GROQ_API_KEY")
        self.model_name = model_name
        self.llm = None
        self._init_llm()

    def _init_llm(self):
        if self.api_key:
            try:
                self.llm = ChatGroq(
                    groq_api_key=self.api_key,
                    model_name=self.model_name,
                    temperature=0.2,
                    max_tokens=1500
                )
                print(f"ChatGroq initialized with model: {self.model_name}")
            except Exception as e:
                print(f"Failed to initialize ChatGroq: {e}")
                self.llm = None
        else:
            print("Warning: GROQ_API_KEY is not set. LLM calls will return simulated responses.")

    def _call_llm_with_fallback(self, messages: List[Any]) -> tuple:
        """
        Call Groq with automatic fallback across active free models.
        Returns (content, active_model_name).
        """
        # Supported free models on Groq in priority order
        candidates = [self.model_name]
        for m in ["openai/gpt-oss-20b", "openai/gpt-oss-120b", "qwen/qwen3.8-27b"]:
            if m not in candidates:
                candidates.append(m)

        last_err = None
        for model_id in candidates:
            try:
                llm = self.llm if (self.llm and model_id == self.model_name) else ChatGroq(
                    groq_api_key=self.api_key,
                    model_name=model_id,
                    temperature=0.2,
                    max_tokens=1500
                )
                resp = llm.invoke(messages)
                if model_id != self.model_name:
                    print(f"Fallback model '{model_id}' succeeded! Updating active model from '{self.model_name}'.")
                    self.model_name = model_id
                    self.llm = llm
                return resp.content, model_id
            except Exception as e:
                err_str = str(e)
                print(f"Groq call with model '{model_id}' failed: {err_str}")
                last_err = e
                continue

        raise last_err or RuntimeError("All candidate free models failed")

    def query(
        self,
        question: str,
        project_id: Optional[str] = None,
        top_k: int = 5,
        min_score: float = 0.2,
        history: Optional[List[Dict[str, str]]] = None
    ) -> Dict[str, Any]:
        """
        Execute grounded RAG query with explicit source citations and abstention when evidence is insufficient.
        """
        start_time = time.time()
        
        # 1. Retrieve project-isolated chunks
        results = self.retriever.retrieve(
            query=question,
            project_id=project_id,
            top_k=top_k,
            score_threshold=min_score
        )
        
        # Soft fallback: for broad/exploratory questions,
        # if no chunks passed the strict min_score threshold, attempt retrieval with a relaxed threshold (0.10)
        if not results and min_score > 0.10:
            print(f"No chunks reached min_score={min_score}. Attempting soft fallback with threshold 0.10 for broad query...")
            results = self.retriever.retrieve(
                query=question,
                project_id=project_id,
                top_k=min(top_k, 3),
                score_threshold=0.10
            )
            
        # 2. Check if sufficient evidence exists
        if not results:
            latency_ms = int((time.time() - start_time) * 1000)
            return {
                "answer": "I could not find sufficient evidence in the uploaded project materials to answer this question. Please make sure the relevant learning materials are uploaded, or ask about a covered topic.",
                "sources": [],
                "citations": [],
                "confidence": 0.0,
                "latency_ms": latency_ms,
                "model": self.model_name,
                "evidence_found": False
            }
            
        # 3. Format sources and context
        context_blocks = []
        sources = []
        citations = []
        
        for idx, doc in enumerate(results, start=1):
            source_name = doc['metadata'].get('source_file', 'Document')
            page_num = doc['metadata'].get('page', 'Unknown')
            preview = doc['content']
            score = doc['similarity_score']
            
            context_blocks.append(f"[{idx}] Source: {source_name} (Page {page_num})\nContent: {preview}")
            sources.append({
                "source": source_name,
                "page": page_num,
                "score": score,
                "preview": preview[:250] + ("..." if len(preview) > 250 else "")
            })
            citations.append(f"[{idx}] {source_name} — Page {page_num}")
            
        context_str = "\n\n".join(context_blocks)
        max_confidence = max([s['score'] for s in sources]) if sources else 0.0
        
        # 4. Format Prompt
        system_instruction = (
            "You are an expert, supportive AI Study Companion and Tutor. "
            "Your task is to answer the learner's question clearly and accurately using ONLY the provided reference context from their study materials.\n"
            "Rules:\n"
            "1. Ground every claim in the provided context.\n"
            "2. Cite your sources using numbers in square brackets like [1], [2] whenever stating facts.\n"
            "3. If the context does not provide sufficient detail to answer reliably, politely state that the material lacks sufficient information instead of fabricating an answer.\n"
            "4. Provide pedagogical explanations with examples where helpful."
        )
        
        user_prompt = f"Reference Context:\n{context_str}\n\nQuestion: {question}\n\nAnswer with citations:"
        
        # 5. Generate LLM response
        answer_text = ""
        tokens_estimate = 0
        used_model = self.model_name
        if self.api_key:
            try:
                messages = [
                    SystemMessage(content=system_instruction),
                    HumanMessage(content=user_prompt)
                ]
                answer_text, used_model = self._call_llm_with_fallback(messages)
                # Rough token calculation
                tokens_estimate = len(user_prompt.split()) + len(answer_text.split())
            except Exception as e:
                print(f"Error calling LLM: {e}")
                answer_text = f"An error occurred while generating the answer: {str(e)}"
        else:
            answer_text = f"[Simulated Response - No GROQ_API_KEY]\n\nBased on your documents:\n" + "\n".join([f"- {s['preview']}" for s in sources[:2]])
            tokens_estimate = 100

        latency_ms = int((time.time() - start_time) * 1000)
        
        return {
            "answer": answer_text,
            "sources": sources,
            "citations": citations,
            "confidence": max_confidence,
            "latency_ms": latency_ms,
            "tokens_used": tokens_estimate,
            "model": used_model,
            "evidence_found": True
        }
