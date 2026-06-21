"""
AI Study Buddy — Voice Mode
POST /voice/transcribe  → Groq Whisper transcription
POST /voice/evaluate    → RAG-grounded concept evaluation + Socratic follow-up
"""
import json
import logging
import tempfile
import os
from fastapi import APIRouter, UploadFile, File, HTTPException
from pydantic import BaseModel
from typing import Optional

from app.services.groq_client import get_groq_client, groq_complete, strip_code_fences, SMART_MODEL
from app.services.rag import retrieve_context

logger = logging.getLogger(__name__)
router = APIRouter()


# ── Schemas ───────────────────────────────────────────────────────────────────

class EvaluateRequest(BaseModel):
    transcript: str
    concept: Optional[str] = ""       # optional topic hint
    courseId: Optional[str] = ""
    userId:   Optional[str] = ""


# ── Transcription ─────────────────────────────────────────────────────────────

@router.post("/transcribe")
async def transcribe_audio(audio: UploadFile = File(...)):
    """
    Accept any audio file from the browser (WebM/Opus/WAV/MP4),
    transcribe it with Groq Whisper, return { transcript }.
    Groq supports: flac, mp3, mp4, mpeg, mpga, m4a, ogg, wav, webm
    """
    suffix = os.path.splitext(audio.filename or "audio.webm")[1] or ".webm"
    
    # Write to a temp file — Groq SDK requires a file path or file-like object
    with tempfile.NamedTemporaryFile(suffix=suffix, delete=False) as tmp:
        content = await audio.read()
        tmp.write(content)
        tmp_path = tmp.name

    try:
        client = get_groq_client()
        with open(tmp_path, "rb") as f:
            result = client.audio.transcriptions.create(
                file=(os.path.basename(tmp_path), f),
                model="whisper-large-v3",
                response_format="text",
                language="en",
            )
        transcript = result if isinstance(result, str) else result.text
        logger.info(f"Transcribed {len(content)} bytes → {len(transcript)} chars")
        return {"transcript": transcript.strip()}
    except Exception as e:
        logger.error(f"Whisper transcription error: {e}")
        raise HTTPException(status_code=500, detail=f"Transcription failed: {str(e)}")
    finally:
        try:
            os.unlink(tmp_path)
        except Exception:
            pass


# ── Concept Evaluation ────────────────────────────────────────────────────────

@router.post("/evaluate")
async def evaluate_explanation(req: EvaluateRequest):
    """
    Evaluate how well the student explained a concept:
    - score 0-100
    - what was correct / missing
    - a Socratic follow-up question to deepen understanding
    """
    if not req.transcript.strip():
        raise HTTPException(status_code=400, detail="Transcript is empty")

    # Fetch RAG context if we have course info
    context_block = ""
    if req.courseId and req.userId:
        try:
            query = req.concept or req.transcript[:200]
            ctx = retrieve_context(query, req.courseId, req.userId, top_k=4)
            if ctx.strip():
                context_block = f"\nCourse content reference:\n{ctx[:3000]}\n"
        except Exception as e:
            logger.warning(f"RAG retrieval failed (non-fatal): {e}")

    prompt = f"""You are an expert tutor evaluating a student's spoken explanation of a concept.

Student explained{f' the concept: "{req.concept}"' if req.concept else ''}:
"{req.transcript}"
{context_block}

Evaluate the student's explanation carefully and respond with ONLY valid JSON (no markdown):
{{
  "score": <integer 0-100>,
  "isCorrect": <true if score >= 60, else false>,
  "whatWasGood": "<one sentence on what they got right, or 'Good start!' if nothing yet>",
  "whatWasMissing": "<one sentence on key gaps, or empty string if score >= 90>",
  "feedback": "<2-3 sentence encouraging, constructive feedback>",
  "followUpQuestion": "<a Socratic question that probes deeper understanding or fills the gap>"
}}

Scoring guide:
- 0-30: Major misconceptions or very incomplete
- 31-59: Partial understanding, key ideas missing
- 60-79: Good understanding, minor gaps
- 80-100: Excellent, comprehensive explanation"""

    raw = groq_complete(prompt, model=SMART_MODEL, temperature=0.4, max_tokens=512)
    raw = strip_code_fences(raw)

    try:
        result = json.loads(raw)
        # Ensure required fields
        result.setdefault("score", 50)
        result.setdefault("isCorrect", result["score"] >= 60)
        result.setdefault("feedback", "Keep practicing!")
        result.setdefault("followUpQuestion", "Can you explain this concept in your own words?")
        result.setdefault("whatWasGood", "Good effort!")
        result.setdefault("whatWasMissing", "")
        return result
    except json.JSONDecodeError as e:
        logger.error(f"Evaluation JSON parse error: {e}\nRaw: {raw[:300]}")
        return {
            "score": 50,
            "isCorrect": False,
            "whatWasGood": "Good effort!",
            "whatWasMissing": "Unable to fully evaluate. Please try again.",
            "feedback": "I had trouble evaluating your response. Please try speaking more clearly.",
            "followUpQuestion": "Can you explain the main idea of this concept?",
        }
