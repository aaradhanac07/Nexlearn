"""
Chat streaming using Groq — streams answer tokens back to the client via SSE.
After the answer is complete, emits a {sources:[...]} event so the frontend
can render timestamp-linked "Jump to source" chips for YouTube courses.
"""
from fastapi import APIRouter
from fastapi.responses import StreamingResponse
from app.models.schemas import ChatRequest
from app.services.rag import retrieve_context_with_sources
from app.services.groq_client import get_groq_client, SMART_MODEL
import json
import logging

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

router = APIRouter()


async def stream_answer(question: str, context: str, sources: list):
    """Stream answer tokens from Groq, then emit a sources event."""
    prompt = f"""You are a helpful tutor. Answer using ONLY the context below.
If the answer is not in the context, say: I could not find that in your document.

Context:
{context}

Question: {question}
Answer:"""

    logger.info(f"Streaming | context_len={len(context)}")

    try:
        client = get_groq_client()
        stream = client.chat.completions.create(
            messages=[{"role": "user", "content": prompt}],
            model=SMART_MODEL,
            temperature=0.3,
            max_tokens=1024,
            stream=True,
        )
        for chunk in stream:
            token = chunk.choices[0].delta.content or ""
            if token:
                yield f"data: {json.dumps({'token': token})}\n\n"

    except Exception as e:
        error_str = str(e)
        logger.error(f"Groq stream error: {error_str}")
        if "rate_limit" in error_str.lower() or "429" in error_str:
            yield f"data: {json.dumps({'token': 'Rate limited by Groq. Please wait a moment and try again.'})}\n\n"
        elif "GROQ_API_KEY" in error_str or "api_key" in error_str.lower():
            yield f"data: {json.dumps({'token': 'Groq API key missing. Add GROQ_API_KEY to ai-service/.env and restart.'})}\n\n"
        else:
            yield f"data: {json.dumps({'token': f'AI error: {error_str[:120]}'})}\n\n"

    # Emit source metadata so the frontend can render timestamp chips
    if sources:
        yield f"data: {json.dumps({'sources': sources})}\n\n"

    yield "data: [DONE]\n\n"


@router.post("")
async def chat(req: ChatRequest):
    logger.info(f"Chat | courseId={req.courseId} | q={req.question[:60]}")

    retrieval = retrieve_context_with_sources(req.question, req.courseId, req.userId)
    context   = retrieval["context"]
    sources   = retrieval["sources"]
    logger.info(f"Context: {len(context)} chars | sources: {len(sources)}")

    if not context.strip():
        async def no_context():
            msg = json.dumps({"token": "I could not find relevant content in your document. Try rephrasing."})
            yield f"data: {msg}\n\n"
            yield "data: [DONE]\n\n"
        return StreamingResponse(
            no_context(),
            media_type="text/event-stream",
            headers={"Cache-Control": "no-cache", "X-Accel-Buffering": "no"},
        )

    return StreamingResponse(
        stream_answer(req.question, context, sources),
        media_type="text/event-stream",
        headers={"Cache-Control": "no-cache", "X-Accel-Buffering": "no"},
    )