"""
YouTube transcript extraction with timestamp preservation.
Uses youtube-transcript-api v1.x (free, no API key required).

v1.x API changes vs v0.x:
  - YouTubeTranscriptApi is now instantiated: YouTubeTranscriptApi()
  - .fetch(video_id, languages=(...)) replaces .get_transcript()
  - Returns FetchedTranscript (iterable of FetchedTranscriptSnippet dataclass objects)
  - Snippets have .text, .start, .duration attributes (not dict keys)
"""
import re
import logging
from typing import List, Dict, Optional

logger = logging.getLogger(__name__)

# Broad language preference list — fall back through common auto-generated codes
_LANGUAGES = ("en", "en-US", "en-GB", "a.en", "a.en-US", "a.en-GB")


def extract_video_id(url: str) -> Optional[str]:
    """Parse video ID from any YouTube URL format."""
    patterns = [
        r'(?:v=|/v/|youtu\.be/|/embed/|/shorts/)([A-Za-z0-9_-]{11})',
        r'^([A-Za-z0-9_-]{11})$',   # bare video ID
    ]
    for p in patterns:
        m = re.search(p, url.strip())
        if m:
            return m.group(1)
    return None


def fetch_transcript(video_id: str) -> List[Dict]:
    """
    Fetch caption segments from YouTube using youtube-transcript-api v1.x.
    Returns list of {text, start, duration} dicts for compatibility with the
    rest of the pipeline.
    Raises ValueError with a user-friendly message when captions are unavailable.
    """
    from youtube_transcript_api import (
        YouTubeTranscriptApi,
        TranscriptsDisabled,
        NoTranscriptFound,
        CouldNotRetrieveTranscript,
        VideoUnavailable,
    )

    api = YouTubeTranscriptApi()

    try:
        # Try preferred languages first; if none match, fall back to any available
        try:
            fetched = api.fetch(video_id, languages=_LANGUAGES)
        except NoTranscriptFound:
            # Try listing all available transcripts and pick the first one
            try:
                transcript_list = api.list(video_id)
                transcript = next(iter(transcript_list))
                fetched = transcript.fetch()
            except StopIteration:
                raise NoTranscriptFound(video_id, _LANGUAGES, None)

        # Convert FetchedTranscriptSnippet dataclass objects → plain dicts
        segments = [
            {"text": s.text, "start": s.start, "duration": s.duration}
            for s in fetched
            if s.text and s.text.strip()
        ]

        logger.info(f"[YT] Fetched {len(segments)} caption segments for {video_id}")
        return segments

    except TranscriptsDisabled:
        raise ValueError(
            "This video has captions disabled by its creator. "
            "Try a different video, or use the Text tab to paste a transcript manually."
        )
    except NoTranscriptFound:
        raise ValueError(
            "No captions found for this video. "
            "Make sure the video has auto-generated or manual captions enabled."
        )
    except VideoUnavailable:
        raise ValueError(
            "This video is unavailable or private. Please check the URL and try again."
        )
    except CouldNotRetrieveTranscript as e:
        raise ValueError(f"Could not retrieve transcript: {str(e)}")
    except Exception as e:
        raise ValueError(f"Could not fetch transcript: {str(e)}")


def chunk_transcript_with_timestamps(
    segments: List[Dict],
    max_chars: int = 500,
) -> List[Dict]:
    """
    Groups transcript segments into chunks of ~max_chars while preserving
    the start/end timestamps for each chunk.

    Returns list of {text, startTimestamp, endTimestamp} dicts.
    """
    chunks: List[Dict] = []
    current_text = ""
    current_start: Optional[float] = None
    current_end: Optional[float] = None

    for seg in segments:
        raw = seg.get("text", "").strip()
        if not raw:
            continue

        seg_start = seg.get("start", 0.0)
        seg_end   = seg_start + seg.get("duration", 2.0)

        if current_start is None:
            current_start = seg_start

        if current_text and (len(current_text) + len(raw) + 1) > max_chars:
            chunks.append({
                "text":           current_text.strip(),
                "startTimestamp": round(current_start, 2),
                "endTimestamp":   round(current_end, 2),
            })
            current_text  = raw
            current_start = seg_start
            current_end   = seg_end
        else:
            current_text  = (current_text + " " + raw).strip()
            current_end   = seg_end

    if current_text:
        chunks.append({
            "text":           current_text.strip(),
            "startTimestamp": round(current_start or 0, 2),
            "endTimestamp":   round(current_end   or 0, 2),
        })

    logger.info(f"[YT] Chunked into {len(chunks)} timestamp-linked segments")
    return chunks


def get_full_text(segments: List[Dict]) -> str:
    """Flatten all transcript segments into a single plain-text string."""
    return " ".join(s.get("text", "").strip() for s in segments if s.get("text"))


def format_timestamp(seconds: float) -> str:
    """Convert seconds to MM:SS display string."""
    s = int(seconds)
    return f"{s // 60}:{s % 60:02d}"
