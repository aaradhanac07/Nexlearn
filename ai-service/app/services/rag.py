"""
RAG service — retrieves context from Pinecone + generates metadata using Groq.
"""
import json
import re
import logging
from sentence_transformers import SentenceTransformer
from pinecone import Pinecone
from app.core.config import settings
from app.services.groq_client import groq_complete, strip_code_fences, FAST_MODEL, SMART_MODEL

logger = logging.getLogger(__name__)

embed_model = SentenceTransformer('all-MiniLM-L6-v2')
pc    = Pinecone(api_key=settings.pinecone_api_key)
index = pc.Index(settings.pinecone_index)


def get_query_embedding(text: str) -> list:
    return embed_model.encode(text).tolist()


# ─── Basic retrieval (plain text, backward-compatible) ────────────────────────

def retrieve_context(question: str, course_id: str, user_id: str, top_k: int = 5) -> str:
    query_vector = get_query_embedding(question)
    results = index.query(
        vector=query_vector,
        top_k=top_k,
        namespace=course_id,
        filter={"userId": {"$eq": user_id}},
        include_metadata=True,
    )
    logger.info(f"Pinecone matches: {len(results.matches)}")
    chunks = [m.metadata["text"] for m in results.matches if m.metadata.get("text")]
    return "\n\n---\n\n".join(chunks)


# ─── Rich retrieval — returns source metadata for timestamp linking ────────────

def retrieve_context_with_sources(
    question: str, course_id: str, user_id: str, top_k: int = 5
) -> dict:
    """
    Returns {'context': str, 'sources': [{text_preview, videoId?, startTimestamp?, sourceType}]}
    Used by the chat endpoint to emit clickable source chips on the frontend.
    """
    query_vector = get_query_embedding(question)
    results = index.query(
        vector=query_vector,
        top_k=top_k,
        namespace=course_id,
        filter={"userId": {"$eq": user_id}},
        include_metadata=True,
    )

    chunks  = []
    sources = []

    for m in results.matches:
        meta = m.metadata
        if not meta.get("text"):
            continue

        chunks.append(meta["text"])

        source: dict = {
            "textPreview": meta["text"][:120].strip(),
            "sourceType":  meta.get("sourceType", "pdf"),
        }
        if meta.get("videoId"):
            source["videoId"]        = meta["videoId"]
            source["startTimestamp"] = meta.get("startTimestamp", 0)
        sources.append(source)

    return {
        "context": "\n\n---\n\n".join(chunks),
        "sources": sources,
    }


# ─── Metadata generation ──────────────────────────────────────────────────────

def generate_summary_and_concepts(full_text: str) -> dict:
    prompt = f"""You are given a document. Return ONLY valid JSON with these exact keys:
- title: short course title (max 8 words)
- description: one sentence about the content
- summary: exactly 5 bullet points as a list of strings
- concepts: list of top 10 key concepts as strings

Return raw JSON only. No markdown. No code blocks.

Document (first 3000 chars):
{full_text[:3000]}"""

    try:
        raw = groq_complete(prompt, model=FAST_MODEL, max_tokens=512)
        raw = strip_code_fences(raw)
        return json.loads(raw)
    except Exception as e:
        logger.warning(f"[METADATA] Groq unavailable ({e.__class__.__name__}), using fallback")
        first_line = full_text.strip().split('\n')[0][:60] if full_text.strip() else "Uploaded Document"
        return {
            "title":       first_line,
            "description": "Uploaded document",
            "summary":     ["Document uploaded successfully."],
            "concepts":    [],
        }


# ─── Study order ──────────────────────────────────────────────────────────────

def generate_study_order(concepts: list, full_text: str = "") -> list:
    """
    Ask Groq to suggest an optimal study order (foundational → advanced).
    Falls back to the original list if Groq is unavailable.
    """
    if not concepts or len(concepts) < 2:
        return concepts

    prompt = f"""Reorder these concepts from foundational to advanced for studying.
Return ONLY a valid JSON array. No explanation, no markdown.

Concepts: {json.dumps(concepts)}

Output:"""

    try:
        raw = groq_complete(prompt, model=FAST_MODEL, max_tokens=256)
        raw = strip_code_fences(raw)

        # Try direct parse first
        try:
            ordered = json.loads(raw)
        except json.JSONDecodeError:
            # Groq sometimes adds preamble — extract the first [...] block
            match = re.search(r'\[.*?\]', raw, re.DOTALL)
            if not match:
                raise ValueError("No JSON array found in response")
            ordered = json.loads(match.group())

        if isinstance(ordered, list) and len(ordered) > 0:
            # Accept even if length differs slightly (Groq may drop/merge some)
            return ordered
    except Exception as e:
        logger.warning(f"[STUDY_ORDER] Groq error: {e.__class__.__name__}: {e}")

    return concepts


# ─── Cross-reference summary for multi-source merge ──────────────────────────

def generate_merge_summary(pdf_text: str, yt_text: str, concepts: list) -> str:
    """
    Generate a combined summary that highlights where both sources overlap.
    """
    prompt = f"""You have two learning sources about the same topic.

Source A (PDF excerpt, first 1500 chars):
{pdf_text[:1500]}

Source B (YouTube transcript excerpt, first 1500 chars):
{yt_text[:1500]}

Write a 3-sentence unified summary that:
1. Describes the shared topic
2. Notes what Source A (PDF) adds uniquely
3. Notes what Source B (YouTube) adds uniquely

Return plain text only."""

    try:
        return groq_complete(prompt, model=SMART_MODEL)
    except Exception:
        return "Both sources cover overlapping concepts. Review each source for complementary perspectives."