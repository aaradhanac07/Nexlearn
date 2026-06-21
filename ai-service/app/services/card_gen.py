import logging
import json
from app.services.groq_client import groq_complete, strip_code_fences, FAST_MODEL

logger = logging.getLogger(__name__)


def generate_flashcards(full_text: str, count: int = 10) -> list:
    prompt = f"""You are a study assistant. Generate exactly {count} flashcards from the document.

Return ONLY a raw JSON object like this (no markdown, no code blocks):
{{"flashcards": [{{"front": "question", "back": "answer max 2 sentences", "conceptTag": "topic"}}]}}

Document (first 4000 chars):
{full_text[:4000]}"""

    try:
        raw = groq_complete(prompt, model=FAST_MODEL, temperature=0.4, max_tokens=1200)
        raw = strip_code_fences(raw)
        data = json.loads(raw)
        return data.get("flashcards", data.get("cards", []))
    except Exception as e:
        logger.warning(f"[CARD_GEN] Groq error ({e.__class__.__name__}), returning empty flashcards")
        return []