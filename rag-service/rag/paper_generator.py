"""Generate an exam from a project's indexed materials, then render it to PDF."""

import base64
import json
import os
import re
from typing import Any, Dict, List, Optional

from langchain_core.messages import HumanMessage, SystemMessage
from langchain_groq import ChatGroq

from .paper_pdf import render_question_paper

MARKS = {"mcq": 1, "short": 5, "long": 10}
SECTION_META = {
    "mcq": ("A", "Multiple Choice Questions"),
    "short": ("B", "Short Answer Questions"),
    "long": ("C", "Long Answer Questions"),
}
DIFFICULTY_GUIDE = {
    "easy": "Keep every question direct and definition-level.",
    "medium": "Mix recall with short reasoning.",
    "hard": "Ask for comparison, application, and multi-step reasoning that the material still supports.",
    "mixed": "Spread the paper across easy, medium, and hard questions.",
}
DEFAULT_INSTRUCTIONS = [
    "Answer all the questions.",
    "Figures in the right-hand margin indicate marks.",
    "Write only what the question asks.",
]


def _clean(value: Any) -> str:
    return " ".join(str(value or "").replace("\x00", " ").split()).strip()


def _as_list(value: Any) -> List[Any]:
    if value is None:
        return []
    if isinstance(value, list):
        return value
    return [value]


def _clamp(value: int, low: int, high: int) -> int:
    return max(low, min(high, int(value)))


def _parse_json(text: str) -> Dict[str, Any]:
    raw = (text or "").strip()
    raw = re.sub(r"^```(?:json)?\s*", "", raw)
    raw = re.sub(r"\s*```$", "", raw)
    start = raw.find("{")
    end = raw.rfind("}")
    if start == -1 or end <= start:
        raise ValueError("The model did not return a JSON question paper.")
    parsed = json.loads(raw[start : end + 1])
    if not isinstance(parsed, dict):
        raise ValueError("The model did not return a JSON object.")
    return parsed


def _section_type(section: Dict[str, Any], index: int) -> str:
    raw = _clean(
        section.get("type") or section.get("id") or section.get("title") or ""
    ).lower()
    if any(token in raw for token in ("mcq", "multiple", "choice", "objective")) or raw == "a":
        return "mcq"
    if any(token in raw for token in ("long", "essay", "discuss")) or raw == "c":
        return "long"
    if "short" in raw or raw == "b":
        return "short"
    return ("mcq", "short", "long")[min(index, 2)]


def _question_type(question: Dict[str, Any], fallback: str) -> str:
    raw = _clean(question.get("type") or "").lower()
    options = question.get("options") or question.get("choices")
    if "mcq" in raw or "choice" in raw or "multiple" in raw:
        return "mcq"
    if options and fallback == "mcq":
        return "mcq"
    if "long" in raw or "essay" in raw:
        return "long"
    if "short" in raw:
        return "short"
    if options and not raw:
        return "mcq"
    return fallback


def _option_text(option: Any) -> str:
    if isinstance(option, dict):
        option = option.get("text") or option.get("option") or option.get("value") or ""
    text = _clean(option)
    return re.sub(r"^[A-Da-d][\).:\-]\s*", "", text).strip()


def _mcq_letter(answer: Any, options: List[str]) -> str:
    text = _clean(answer)
    if text[:1].upper() in "ABCD" and (len(text) == 1 or text[1] in ".)"):
        return text[:1].upper()
    for index, option in enumerate(options):
        if text.lower() == option.lower():
            return "ABCD"[index]
    return "A" if options else ""


def _parts(question: Dict[str, Any]) -> List[str]:
    parts = []
    for part in _as_list(question.get("parts") or question.get("subparts")):
        if isinstance(part, dict):
            part = part.get("prompt") or part.get("text") or ""
        text = re.sub(r"^\(?[a-dA-D]\)?[\).:\-]\s*", "", _clean(part)).strip()
        if text:
            parts.append(text[:400])
    return parts[:4]


def normalize_generated_paper(
    payload: Dict[str, Any],
    counts: Dict[str, int],
) -> Dict[str, Any]:
    """Coerce model JSON into numbered sections with a fixed mark scheme."""
    buckets: Dict[str, List[Dict[str, Any]]] = {"mcq": [], "short": [], "long": []}
    sections = payload.get("sections")
    flat = payload.get("questions")

    raw_sections: List[Dict[str, Any]] = []
    if isinstance(sections, list) and sections:
        raw_sections = [item for item in sections if isinstance(item, dict)]
    elif isinstance(flat, list):
        raw_sections = [{"type": "mixed", "questions": flat}]

    for index, section in enumerate(raw_sections):
        fallback = _section_type(section, index)
        for question in _as_list(section.get("questions")):
            if not isinstance(question, dict):
                continue
            kind = _question_type(question, fallback)
            prompt = _clean(question.get("prompt") or question.get("question") or question.get("text"))
            if len(prompt) < 8:
                continue
            options = []
            if kind == "mcq":
                options = [
                    text
                    for text in (_option_text(item) for item in _as_list(question.get("options") or question.get("choices")))
                    if text
                ][:4]
                if len(options) < 2:
                    continue
            item = {
                "type": kind,
                "prompt": prompt[:900],
                "options": options,
                "parts": _parts(question) if kind == "long" else [],
                "marks": MARKS[kind],
                "answer": _mcq_letter(question.get("answer") or question.get("correctAnswer"), options)
                if kind == "mcq"
                else _clean(question.get("answer") or question.get("sampleAnswer") or question.get("expected_answer"))[:1200],
                "explanation": _clean(question.get("explanation") or "")[:500],
            }
            buckets[kind].append(item)

    ordered = []
    for kind in ("mcq", "short", "long"):
        wanted = counts.get(kind, 0)
        chosen = buckets[kind][:wanted]
        if wanted > 0 and chosen:
            ordered.append((kind, chosen))

    if not ordered:
        raise ValueError("The model did not return any usable questions from the study material.")

    # Re-letter so a paper with no MCQs still starts at Section A.
    letters = "ABCDEF"
    sections_out = []
    number = 1
    for slot, (kind, questions) in enumerate(ordered):
        _default_letter, title = SECTION_META[kind]
        prepared = []
        for question in questions:
            question = dict(question)
            question["number"] = number
            number += 1
            prepared.append(question)
        sections_out.append(
            {
                "id": letters[slot],
                "title": title,
                "type": kind,
                "marks_each": MARKS[kind],
                "questions": prepared,
            }
        )

    instructions = [_clean(item) for item in _as_list(payload.get("instructions")) if _clean(item)]
    if len(instructions) < 2:
        instructions = list(DEFAULT_INSTRUCTIONS)

    total_marks = sum(q["marks"] for section in sections_out for q in section["questions"])
    return {
        "instructions": instructions[:5],
        "sections": sections_out,
        "total_marks": total_marks,
        "question_count": number - 1,
    }


def gather_material_chunks(vector_store, retriever, project_id: str, topic: str, limit: int = 12) -> List[Dict[str, Any]]:
    query = topic.strip() if topic and topic.strip() else "core concepts definitions processes examples formulas and important facts"
    retrieved = retriever.retrieve(
        query=query,
        project_id=str(project_id),
        top_k=max(limit, 8),
        score_threshold=0.0,
    )

    chunks: List[Dict[str, Any]] = []
    seen = set()

    def add(text: Optional[str], meta: Optional[Dict[str, Any]]):
        body = _clean(text)[:900]
        if len(body) < 40:
            return
        key = body[:180]
        if key in seen:
            return
        seen.add(key)
        meta = meta or {}
        chunks.append(
            {
                "text": body,
                "source": _clean(meta.get("source_file") or meta.get("source") or "Material") or "Material",
                "page": meta.get("page", ""),
            }
        )

    for doc in retrieved or []:
        add(doc.get("content"), doc.get("metadata"))
        if len(chunks) >= limit:
            return chunks[:limit]

    try:
        raw = vector_store.collection.get(
            where={"projectId": {"$eq": str(project_id)}},
            include=["documents", "metadatas"],
            limit=80,
        )
        documents = raw.get("documents") or []
        metadatas = raw.get("metadatas") or []
        if documents:
            step = max(1, len(documents) // 8)
            for index in range(0, len(documents), step):
                meta = metadatas[index] if index < len(metadatas) else {}
                add(documents[index], meta)
                if len(chunks) >= limit:
                    break
    except Exception as exc:
        print(f"Broad material sample failed: {exc}")

    return chunks[:limit]


def _format_context(chunks: List[Dict[str, Any]]) -> str:
    blocks = []
    budget = 9000
    used = 0
    for index, chunk in enumerate(chunks, start=1):
        block = f"[{index}] {chunk['source']} page {chunk['page']}\n{chunk['text']}"
        if used + len(block) > budget:
            break
        blocks.append(block)
        used += len(block)
    return "\n\n".join(blocks)


def _call_llm(api_key: str, model_name: str, messages: List[Any]) -> tuple:
    if not api_key or api_key.strip() in {"", "your_groq_api_key_here"}:
        raise ValueError("GROQ_API_KEY is not configured, so questions cannot be generated.")

    candidates = []
    for model_id in (model_name, "openai/gpt-oss-20b", "openai/gpt-oss-120b", "qwen/qwen3.8-27b"):
        if model_id and model_id not in candidates:
            candidates.append(model_id)

    last_error = None
    for model_id in candidates:
        try:
            llm = ChatGroq(
                groq_api_key=api_key,
                model_name=model_id,
                temperature=0.4,
                max_tokens=4096,
            )
            response = llm.invoke(messages)
            content = getattr(response, "content", "") or ""
            if isinstance(content, list):
                content = " ".join(
                    part.get("text", "") if isinstance(part, dict) else str(part) for part in content
                )
            return str(content), model_id
        except Exception as exc:
            print(f"Question paper model '{model_id}' failed: {exc}")
            last_error = exc
    raise RuntimeError(f"Question generation failed: {last_error}")


def _build_prompt(context: str, counts: Dict[str, int], difficulty: str, topic: str) -> List[Any]:
    focus = topic.strip() if topic and topic.strip() else "Cover the study material broadly."
    guide = DIFFICULTY_GUIDE.get(difficulty, DIFFICULTY_GUIDE["mixed"])
    system = (
        "You write university question papers. Use only the supplied study material. "
        "Do not invent facts, formulas, names, or options that the material does not support. "
        "Every question must be answerable from that material. "
        "Return one JSON object and no other text."
    )
    user = f"""Study material:
{context}

Write a question paper with:
- exactly {counts['mcq']} multiple-choice questions, each with 4 options and marks 1
- exactly {counts['short']} short-answer questions, marks 5
- exactly {counts['long']} long-answer questions, marks 10
Omit a section whose count is 0.
Difficulty: {guide}
Focus: {focus}

JSON shape:
{{
  "instructions": ["Answer all the questions.", "Figures in the margin indicate marks."],
  "sections": [
    {{
      "id": "A",
      "title": "Multiple Choice Questions",
      "type": "mcq",
      "questions": [
        {{
          "prompt": "question text",
          "options": ["first", "second", "third", "fourth"],
          "answer": "A",
          "explanation": "one sentence from the material",
          "marks": 1
        }}
      ]
    }},
    {{
      "id": "B",
      "title": "Short Answer Questions",
      "type": "short",
      "questions": [
        {{"prompt": "question text", "answer": "expected answer", "explanation": "why", "marks": 5}}
      ]
    }},
    {{
      "id": "C",
      "title": "Long Answer Questions",
      "type": "long",
      "questions": [
        {{"prompt": "question text", "parts": ["optional sub-part"], "answer": "expected answer", "explanation": "why", "marks": 10}}
      ]
    }}
  ]
}}
Do not prefix options with A, B, C, or D. The answer field for a multiple-choice question must be A, B, C, or D."""
    return [SystemMessage(content=system), HumanMessage(content=user)]


def _grounded_label(chunks: List[Dict[str, Any]]) -> str:
    names = []
    for chunk in chunks:
        name = _clean(chunk.get("source"))
        if name and name not in names:
            names.append(name)
    if not names:
        return ""
    if len(names) <= 3:
        listed = ", ".join(names)
    else:
        listed = ", ".join(names[:3]) + f", and {len(names) - 3} more"
    return f"Grounded in: {listed}"


def build_question_paper(
    *,
    retriever,
    vector_store,
    project_id: str,
    title: str,
    subject: str = "",
    topic: str = "",
    duration_minutes: int = 90,
    mcq_count: int = 5,
    short_count: int = 3,
    long_count: int = 2,
    difficulty: str = "mixed",
    include_answer_key: bool = False,
    model_name: str = "openai/gpt-oss-20b",
    api_key: Optional[str] = None,
) -> Dict[str, Any]:
    counts = {
        "mcq": _clamp(mcq_count, 0, 12),
        "short": _clamp(short_count, 0, 6),
        "long": _clamp(long_count, 0, 4),
    }
    if sum(counts.values()) < 1:
        raise ValueError("Choose at least one question to generate.")

    difficulty = difficulty if difficulty in DIFFICULTY_GUIDE else "mixed"
    chunks = gather_material_chunks(vector_store, retriever, project_id, topic)
    if not chunks:
        raise ValueError(
            "No indexed study material was found for this project. Upload a PDF and wait until it is ready."
        )

    print(f"Generating question paper for project {project_id} from {len(chunks)} excerpts")
    messages = _build_prompt(_format_context(chunks), counts, difficulty, topic or "")
    api_key = api_key or os.environ.get("GROQ_API_KEY")
    content, used_model = _call_llm(api_key, model_name, messages)
    try:
        parsed = _parse_json(content)
    except (ValueError, json.JSONDecodeError) as first_error:
        print(f"Question paper JSON parse failed ({first_error}). Retrying once.")
        retry = messages + [
            HumanMessage(content="That response was not valid JSON. Return only the JSON object, with no markdown.")
        ]
        content, used_model = _call_llm(api_key, used_model, retry)
        try:
            parsed = _parse_json(content)
        except (ValueError, json.JSONDecodeError) as exc:
            raise RuntimeError("The model returned a question paper that could not be read. Try again.") from exc

    normalized = normalize_generated_paper(parsed, counts)
    paper = {
        "title": _clean(title)[:140] or "Question Paper",
        "subject": _clean(subject)[:80],
        "topic": _clean(topic)[:200],
        "duration_minutes": _clamp(duration_minutes, 15, 180),
        "difficulty": difficulty,
        "include_answer_key": bool(include_answer_key),
        "instructions": normalized["instructions"],
        "sections": normalized["sections"],
        "total_marks": normalized["total_marks"],
        "question_count": normalized["question_count"],
        "grounded_in": _grounded_label(chunks),
        "sources": [
            {"source": chunk["source"], "page": chunk["page"]}
            for chunk in chunks[:12]
        ],
        "model": used_model,
    }
    pdf_bytes = render_question_paper(paper)
    paper["pdf_base64"] = base64.b64encode(pdf_bytes).decode("ascii")
    return paper
