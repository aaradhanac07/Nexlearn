"""
Ingest endpoints — PDF (existing), YouTube, Text, and multi-source Merge.
YouTube and Text endpoints stream live pipeline progress via SSE.
"""
import json
import asyncio
import logging

from fastapi import APIRouter, UploadFile, File, Form, HTTPException
from fastapi.responses import StreamingResponse

from app.services.pdf_parser         import parse_pdf
from app.services.chunker            import chunk_text
from app.services.embedder           import embed_and_store, embed_and_store_with_meta
from app.services.rag                import (
    generate_summary_and_concepts,
    generate_study_order,
    generate_merge_summary,
)
from app.services.card_gen           import generate_flashcards
from app.services.youtube_ingest     import (
    extract_video_id,
    fetch_transcript,
    chunk_transcript_with_timestamps,
    get_full_text,
)

logger = logging.getLogger(__name__)
logging.basicConfig(level=logging.INFO)

router = APIRouter()


# ─── Helpers ─────────────────────────────────────────────────────────────────

def _sse(payload: dict) -> str:
    return f"data: {json.dumps(payload)}\n\n"

def _stage(stage: str, message: str) -> str:
    return _sse({"stage": stage, "message": message})

def _error(message: str) -> str:
    return _sse({"stage": "error", "message": message})


# ─── Existing PDF endpoint (unchanged) ───────────────────────────────────────

@router.post("/pdf")
async def ingest_pdf(
    file:     UploadFile = File(...),
    courseId: str        = Form(...),
    userId:   str        = Form(...),
):
    try:
        logger.info(f"[INGEST START] courseId={courseId}, userId={userId}, filename={file.filename}")

        # file_bytes = await file.read()
        # logger.info(f"[FILE READ] File size: {len(file_bytes)} bytes")

        # try:
        #     full_text = parse_pdf(file_bytes)
        #     logger.info(f"[PDF PARSED] Extracted {len(full_text)} characters")
        file_bytes = await file.read()
        logger.info(f"[FILE READ] File size: {len(file_bytes)} bytes")

        logger.info("[STEP 1] About to parse PDF")

        try:
            full_text = parse_pdf(file_bytes)
            logger.info("[STEP 2] PDF parsed successfully")
            logger.info(f"[PDF PARSED] Extracted {len(full_text)} characters")
        except Exception as e:
            raise HTTPException(status_code=400, detail=f"PDF parsing failed: {str(e)}")

        if not full_text.strip():
            raise HTTPException(status_code=400, detail="Could not extract text from PDF")

        chunks = chunk_text(full_text)
        logger.info(f"[CHUNKING COMPLETE] Created {len(chunks)} chunks")

        import gc
        del file_bytes
        del full_text
        gc.collect()

        embed_and_store(chunks, courseId, userId)
        logger.info("[EMBEDDING COMPLETE] Stored in Pinecone")

        # ── Run metadata + flashcards in parallel ────────────────────────────
        import asyncio as _aio
        meta_task  = _aio.to_thread(generate_summary_and_concepts, full_text)
        cards_task = _aio.to_thread(generate_flashcards, full_text)
        results = await _aio.gather(meta_task, cards_task, return_exceptions=True)

        metadata   = results[0] if not isinstance(results[0], Exception) else \
                     {"title": "Document", "description": "", "summary": [], "concepts": []}
        flashcards = results[1] if not isinstance(results[1], Exception) else []

        return {
            "status":     "success",
            "chunkCount": len(chunks),
            "metadata":   metadata,
            "flashcards": flashcards,
        }

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"[INGEST FATAL ERROR] {str(e)}", exc_info=True)
        raise HTTPException(status_code=500, detail=f"Ingest failed: {str(e)}")


# ─── YouTube SSE endpoint ─────────────────────────────────────────────────────

@router.post("/youtube")
async def ingest_youtube(
    youtubeUrl: str = Form(...),
    courseId:   str = Form(...),
    userId:     str = Form(...),
):
    async def pipeline():
        try:
            # 1. Extract video ID
            yield _stage("fetching", "Validating YouTube URL…")
            video_id = extract_video_id(youtubeUrl)
            if not video_id:
                yield _error("Invalid YouTube URL. Please check and try again.")
                return

            # 2. Fetch transcript
            yield _stage("fetching", "Fetching YouTube captions…")
            try:
                segments = await asyncio.to_thread(fetch_transcript, video_id)
            except ValueError as e:
                yield _error(str(e))
                return

            full_text = get_full_text(segments)
            yield _stage("fetching", f"Got {len(segments)} caption segments · {len(full_text):,} chars")

            # 3. Chunk with timestamps
            yield _stage("chunking", "Splitting transcript into timestamp-linked segments…")
            raw_chunks = await asyncio.to_thread(
                chunk_transcript_with_timestamps, segments
            )
            # Annotate each chunk with YouTube source metadata
            chunks_with_meta = [
                {**c, "sourceType": "youtube", "videoId": video_id, "sourceName": youtubeUrl}
                for c in raw_chunks
            ]
            yield _stage("chunking", f"Created {len(chunks_with_meta)} segments")

            # 4. Embed + store
            yield _stage("embedding", "Generating semantic embeddings…")
            try:
                await asyncio.to_thread(
                    embed_and_store_with_meta, chunks_with_meta, courseId, userId
                )
            except Exception as e:
                yield _error(f"Embedding failed: {str(e)}")
                return
            yield _stage("embedding", "Knowledge base updated ✓")

            # 5 + 6. Analyse content & generate flashcards IN PARALLEL
            yield _stage("analyzing", "Building knowledge graph and generating flashcards…")
            meta_task  = asyncio.to_thread(generate_summary_and_concepts, full_text)
            cards_task = asyncio.to_thread(generate_flashcards, full_text)
            _results   = await asyncio.gather(meta_task, cards_task, return_exceptions=True)

            metadata   = _results[0] if not isinstance(_results[0], Exception) else \
                         {"title": f"YouTube: {video_id}", "description": "", "summary": [], "concepts": []}
            flashcards = _results[1] if not isinstance(_results[1], Exception) else []

            # Study order uses concepts from metadata — still fast, runs after
            try:
                study_order = await asyncio.to_thread(
                    generate_study_order, metadata.get("concepts", []), full_text
                )
            except Exception:
                study_order = metadata.get("concepts", [])

            yield _stage("analyzing", f"Found {len(metadata.get('concepts', []))} key concepts")
            yield _stage("flashcards", f"Created {len(flashcards)} flashcards ✓")

            # 7. Done
            result = {
                "metadata":   {**metadata, "videoId": video_id, "youtubeUrl": youtubeUrl},
                "flashcards": flashcards,
                "chunkCount": len(chunks_with_meta),
                "studyOrder": study_order,
                "sources": [{
                    "type":       "youtube",
                    "url":        youtubeUrl,
                    "videoId":    video_id,
                    "chunkCount": len(chunks_with_meta),
                }],
            }
            yield _sse({"stage": "complete", "result": result})

        except Exception as e:
            logger.error(f"[INGEST_YT] Fatal: {e}", exc_info=True)
            yield _error(f"Unexpected error: {str(e)[:200]}")

    return StreamingResponse(
        pipeline(),
        media_type="text/event-stream",
        headers={"Cache-Control": "no-cache", "X-Accel-Buffering": "no"},
    )


# ─── Text / paste SSE endpoint ────────────────────────────────────────────────

@router.post("/text")
async def ingest_text(
    text:      str = Form(...),
    courseId:  str = Form(...),
    userId:    str = Form(...),
    sourceName: str = Form(default="Pasted Notes"),
):
    async def pipeline():
        try:
            if not text.strip():
                yield _error("No text provided.")
                return

            yield _stage("chunking", f"Processing {len(text):,} characters…")
            raw_chunks = await asyncio.to_thread(chunk_text, text)
            chunks_with_meta = [
                {"text": c, "sourceType": "text", "sourceName": sourceName}
                for c in raw_chunks
            ]
            yield _stage("chunking", f"Split into {len(chunks_with_meta)} chunks")

            yield _stage("embedding", "Generating semantic embeddings…")
            try:
                await asyncio.to_thread(
                    embed_and_store_with_meta, chunks_with_meta, courseId, userId
                )
            except Exception as e:
                yield _error(f"Embedding failed: {str(e)}")
                return
            yield _stage("embedding", "Knowledge base updated ✓")

            yield _stage("analyzing", "Building knowledge graph and generating flashcards…")
            meta_task  = asyncio.to_thread(generate_summary_and_concepts, text)
            cards_task = asyncio.to_thread(generate_flashcards, text)
            _results   = await asyncio.gather(meta_task, cards_task, return_exceptions=True)

            metadata   = _results[0] if not isinstance(_results[0], Exception) else \
                         {"title": sourceName, "description": "", "summary": [], "concepts": []}
            flashcards = _results[1] if not isinstance(_results[1], Exception) else []

            try:
                study_order = await asyncio.to_thread(
                    generate_study_order, metadata.get("concepts", []), text
                )
            except Exception:
                study_order = metadata.get("concepts", [])

            yield _stage("analyzing", f"Found {len(metadata.get('concepts', []))} key concepts")
            yield _stage("flashcards", f"Created {len(flashcards)} flashcards ✓")

            result = {
                "metadata":   metadata,
                "flashcards": flashcards,
                "chunkCount": len(chunks_with_meta),
                "studyOrder": study_order,
                "sources": [{"type": "text", "name": sourceName, "chunkCount": len(chunks_with_meta)}],
            }
            yield _sse({"stage": "complete", "result": result})

        except Exception as e:
            logger.error(f"[INGEST_TEXT] Fatal: {e}", exc_info=True)
            yield _error(f"Unexpected error: {str(e)[:200]}")

    return StreamingResponse(
        pipeline(),
        media_type="text/event-stream",
        headers={"Cache-Control": "no-cache", "X-Accel-Buffering": "no"},
    )


# ─── Multi-source Merge SSE endpoint ─────────────────────────────────────────

@router.post("/merge")
async def ingest_merge(
    courseId:   str        = Form(...),
    userId:     str        = Form(...),
    youtubeUrl: str        = Form(default=""),
    file:       UploadFile = File(default=None),
):
    """
    Ingests a PDF + YouTube video into the same courseId namespace,
    then generates a cross-reference summary.
    """
    async def pipeline():
        try:
            has_pdf = file is not None and file.filename
            has_yt  = bool(youtubeUrl.strip())

            if not has_pdf and not has_yt:
                yield _error("Provide at least one source (PDF or YouTube URL).")
                return

            pdf_text = ""
            yt_text  = ""
            sources  = []
            all_flashcards = []

            # ── PDF branch ────────────────────────────────────────────────
            if has_pdf:
                yield _stage("fetching", f"Reading PDF: {file.filename}…")
                file_bytes = await file.read()
                try:
                    pdf_text = await asyncio.to_thread(parse_pdf, file_bytes)
                except Exception as e:
                    yield _error(f"PDF parse failed: {str(e)}")
                    return

                yield _stage("chunking", "Chunking PDF…")
                pdf_chunks_raw = await asyncio.to_thread(chunk_text, pdf_text)
                pdf_chunks = [
                    {"text": c, "sourceType": "pdf", "sourceName": file.filename}
                    for c in pdf_chunks_raw
                ]
                yield _stage("embedding", f"Embedding {len(pdf_chunks)} PDF chunks…")
                await asyncio.to_thread(embed_and_store_with_meta, pdf_chunks, courseId, userId)
                sources.append({"type": "pdf", "name": file.filename, "chunkCount": len(pdf_chunks)})
                yield _stage("embedding", "PDF stored ✓")

            # ── YouTube branch ────────────────────────────────────────────
            if has_yt:
                yield _stage("fetching", "Fetching YouTube captions…")
                video_id = extract_video_id(youtubeUrl)
                if not video_id:
                    yield _error("Invalid YouTube URL.")
                    return

                try:
                    segments = await asyncio.to_thread(fetch_transcript, video_id)
                except ValueError as e:
                    yield _error(str(e))
                    return

                yt_text = get_full_text(segments)
                yield _stage("fetching", f"Got {len(segments)} caption segments ✓")

                yield _stage("chunking", "Chunking YouTube transcript…")
                yt_chunks_raw = await asyncio.to_thread(chunk_transcript_with_timestamps, segments)
                yt_chunks = [
                    {**c, "sourceType": "youtube", "videoId": video_id, "sourceName": youtubeUrl}
                    for c in yt_chunks_raw
                ]
                yield _stage("embedding", f"Embedding {len(yt_chunks)} video chunks…")
                await asyncio.to_thread(embed_and_store_with_meta, yt_chunks, courseId, userId)
                sources.append({"type": "youtube", "url": youtubeUrl, "videoId": video_id, "chunkCount": len(yt_chunks)})
                yield _stage("embedding", "Video stored ✓")

            # ── Unified analysis — metadata + flashcards IN PARALLEL ──────
            combined_text = (pdf_text + " " + yt_text).strip()
            yield _stage("analyzing", "Cross-referencing sources and building unified knowledge graph…")

            meta_task  = asyncio.to_thread(generate_summary_and_concepts, combined_text)
            cards_task = asyncio.to_thread(generate_flashcards, combined_text)
            _results   = await asyncio.gather(meta_task, cards_task, return_exceptions=True)

            metadata      = _results[0] if not isinstance(_results[0], Exception) else \
                            {"title": "Merged Course", "description": "", "summary": [], "concepts": []}
            all_flashcards = _results[1] if not isinstance(_results[1], Exception) else []

            if has_pdf and has_yt:
                try:
                    cross_ref = await asyncio.to_thread(generate_merge_summary, pdf_text, yt_text, metadata.get("concepts", []))
                    metadata["crossReference"] = cross_ref
                except Exception:
                    pass

            try:
                study_order = await asyncio.to_thread(
                    generate_study_order, metadata.get("concepts", []), combined_text
                )
            except Exception:
                study_order = metadata.get("concepts", [])

            yield _stage("analyzing", f"Found {len(metadata.get('concepts', []))} unified concepts ✓")
            yield _stage("flashcards", f"Created {len(all_flashcards)} flashcards ✓")

            result = {
                "metadata":   metadata,
                "flashcards": all_flashcards,
                "studyOrder": study_order,
                "sources":    sources,
                "chunkCount": sum(s.get("chunkCount", 0) for s in sources),
            }
            yield _sse({"stage": "complete", "result": result})

        except Exception as e:
            logger.error(f"[INGEST_MERGE] Fatal: {e}", exc_info=True)
            yield _error(f"Unexpected error: {str(e)[:200]}")

    return StreamingResponse(
        pipeline(),
        media_type="text/event-stream",
        headers={"Cache-Control": "no-cache", "X-Accel-Buffering": "no"},
    )