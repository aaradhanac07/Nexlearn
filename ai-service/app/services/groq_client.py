"""
Shared Groq client — used by all AI services.
Free tier: 14,400 requests/day, no billing required.
Sign up at: https://console.groq.com
"""
from groq import Groq
from app.core.config import settings
import logging

logger = logging.getLogger(__name__)

# Model choices (all free on Groq):
# "llama-3.1-8b-instant"     — fastest, good for most tasks
# "llama-3.3-70b-versatile"  — smartest, best for quiz/graph generation
FAST_MODEL = "llama-3.1-8b-instant"
SMART_MODEL = "llama-3.3-70b-versatile"

# ── Singleton client — instantiate once, reuse forever ───────────────────────
_client: Groq | None = None

def get_groq_client() -> Groq:
    global _client
    if _client is None:
        if not settings.groq_api_key:
            raise RuntimeError(
                "GROQ_API_KEY not set in ai-service/.env. "
                "Get a free key at https://console.groq.com"
            )
        _client = Groq(api_key=settings.groq_api_key)
    return _client


def groq_complete(
    prompt: str,
    model: str = FAST_MODEL,
    temperature: float = 0.3,
    max_tokens: int = 1024,
) -> str:
    """Non-streaming completion — returns the full text response."""
    client = get_groq_client()
    response = client.chat.completions.create(
        messages=[{"role": "user", "content": prompt}],
        model=model,
        temperature=temperature,
        max_tokens=max_tokens,
    )
    return response.choices[0].message.content or ""


def strip_code_fences(raw: str) -> str:
    """Strip markdown ```json ... ``` wrappers that LLMs sometimes add."""
    raw = raw.strip()
    if raw.startswith("```"):
        lines = raw.split("\n")
        # Remove first line (```json or ```) and last line (```)
        inner = lines[1:] if len(lines) > 1 else lines
        if inner and inner[-1].strip() == "```":
            inner = inner[:-1]
        raw = "\n".join(inner)
    return raw.strip()
