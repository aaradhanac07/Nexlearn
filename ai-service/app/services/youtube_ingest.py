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
    Fetch caption segments from YouTube using yt-dlp (bypasses most IP bans).
    Returns list of {text, start, duration} dicts.
    Raises ValueError with a user-friendly message when captions are unavailable.
    """
    import yt_dlp
    import requests
    
    ydl_opts = {
        'skip_download': True,
        'writesubtitles': True,
        'writeautomaticsub': True,
        'subtitleslangs': ['en'],
        'quiet': True,
        'dump_single_json': True,
        'extract_flat': False
    }
    
    try:
        with yt_dlp.YoutubeDL(ydl_opts) as ydl:
            info = ydl.extract_info(f'https://www.youtube.com/watch?v={video_id}', download=False)
            
            subs = info.get('subtitles', {})
            auto_subs = info.get('automatic_captions', {})
            
            url = None
            if 'en' in subs:
                url = subs['en'][0]['url']
            elif 'en' in auto_subs:
                url = auto_subs['en'][0]['url']
                
            if not url:
                # Fallback to any available language if english is not found
                for lang in subs:
                    url = subs[lang][0]['url']
                    break
                if not url:
                    for lang in auto_subs:
                        url = auto_subs[lang][0]['url']
                        break
            
            if not url:
                raise ValueError(
                    "No captions found for this video. "
                    "Make sure the video has auto-generated or manual captions enabled."
                )
                
            res = requests.get(url, timeout=10)
            res.raise_for_status()
            data = res.json()
            
            segments = []
            for event in data.get('events', []):
                if 'segs' in event:
                    text = ''.join(seg.get('utf8', '') for seg in event['segs']).replace('\n', ' ').strip()
                    if not text:
                        continue
                    start = event.get('tStartMs', 0) / 1000.0
                    duration = event.get('dDurationMs', 0) / 1000.0
                    segments.append({"text": text, "start": start, "duration": duration})
                    
            if not segments:
                raise ValueError("Parsed transcript was empty.")
                
            logger.info(f"[YT] Fetched {len(segments)} caption segments for {video_id}")
            return segments

    except ValueError as ve:
        raise ve
    except Exception as e:
        logger.error(f"yt-dlp fetch failed for {video_id}: {str(e)}")
        raise ValueError(
            "This video is unavailable, private, or YouTube is blocking requests. "
            "Please try another video or paste text manually."
        )


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
