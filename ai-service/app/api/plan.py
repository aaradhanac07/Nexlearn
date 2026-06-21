"""
Auto Study Plan Generator
POST /plan/generate  → AI-built day-by-day schedule (SM-2 reviews + new content)
"""
import json
import asyncio
import logging
from datetime import datetime, date, timedelta
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from typing import List, Optional

from app.services.groq_client import groq_complete, strip_code_fences, SMART_MODEL

logger = logging.getLogger(__name__)
router = APIRouter()


# ── Schemas ───────────────────────────────────────────────────────────────────

class PlanRequest(BaseModel):
    examDate: str          # ISO date string  "2026-07-15"
    topics: List[str]      # ["Photosynthesis", "Cell division", ...]
    dailyHours: float      # 2.0
    startDate: Optional[str] = None  # ISO date, defaults to today
    courseId: Optional[str] = ""
    userId:   Optional[str] = ""


# ── Helpers ───────────────────────────────────────────────────────────────────

def date_range(start: date, end: date):
    """Yield all dates from start up to (not including) end."""
    current = start
    while current < end:
        yield current
        current += timedelta(days=1)


def build_sm2_schedule(topics: list, total_days: int) -> dict:
    """
    Simple SM-2-inspired distribution:
    Each topic gets reviewed on day 1, day 7, day 14, day 21...
    Returns dict: day_index → [topics to review that day]
    """
    schedule = {}
    for i, topic in enumerate(topics):
        # Stagger first review: each topic starts on a different day (round-robin)
        first_day = i % max(1, min(7, total_days // 3))
        for interval in [0, 3, 7, 14, 21, 30]:
            day = first_day + interval
            if day < total_days:
                schedule.setdefault(day, []).append(topic)
    return schedule


# ── Endpoint ──────────────────────────────────────────────────────────────────

@router.post("/generate")
async def generate_plan(req: PlanRequest):
    """
    Build a day-by-day study plan:
    - Distributes new topics evenly
    - Inserts SM-2 review slots at scientifically optimal intervals
    - Respects daily hours constraint
    """
    try:
        exam_dt  = date.fromisoformat(req.examDate)
        start_dt = date.fromisoformat(req.startDate) if req.startDate else date.today()
    except ValueError as e:
        raise HTTPException(status_code=400, detail=f"Invalid date: {e}")

    if exam_dt <= start_dt:
        raise HTTPException(status_code=400, detail="Exam date must be after start date")

    total_days  = (exam_dt - start_dt).days
    daily_mins  = int(req.dailyHours * 60)
    topics      = req.topics if req.topics else ["General review"]

    # SM-2 review schedule: day_index → list of topics to review
    review_map = build_sm2_schedule(topics, total_days)

    # Ask Groq to build a structured plan
    prompt = f"""You are a study planning expert. Create a detailed day-by-day study schedule.

Parameters:
- Start date: {start_dt.isoformat()}
- Exam date: {req.examDate}  ({total_days} days total)
- Topics to master: {json.dumps(topics)}
- Daily study time: {req.dailyHours} hours ({daily_mins} minutes)

Rules:
1. Distribute NEW content evenly across the first 70% of days
2. Use the last 30% for comprehensive review and practice exams
3. Each day's slots must NOT exceed {daily_mins} total minutes
4. Include short breaks (mark as type "break") if a day has 3+ slots
5. Every topic must appear at least once as a "new" slot before it appears as "review"
6. SM-2 review intervals: first review on day 3, then day 7, day 14, day 21 after first study

Return ONLY valid JSON (no markdown, no explanation):
{{
  "totalDays": {total_days},
  "examDate": "{req.examDate}",
  "days": [
    {{
      "dayIndex": 0,
      "date": "YYYY-MM-DD",
      "focus": "short theme for the day",
      "totalMinutes": <number>,
      "slots": [
        {{
          "type": "new",
          "topic": "topic name",
          "durationMin": <15-90>,
          "description": "what to study / do"
        }},
        {{
          "type": "review",
          "topic": "topic name",
          "durationMin": <10-30>,
          "description": "SM-2 spaced repetition review"
        }}
      ]
    }}
  ]
}}

Generate ALL {total_days} days. Keep each slot description concise (max 10 words)."""

    # Run the blocking Groq call in a thread pool so we don't stall the event loop
    raw = await asyncio.to_thread(
        groq_complete, prompt, SMART_MODEL, 0.3, 8192
    )
    raw = strip_code_fences(raw)

    try:
        plan_data = json.loads(raw)
        days = plan_data.get("days", [])
    except json.JSONDecodeError as e:
        logger.error(f"Plan JSON parse error: {e}\nRaw (first 500): {raw[:500]}")
        # Try to salvage a partial JSON array — trim to last complete day object
        try:
            brace_depth = 0
            last_good_pos = 0
            in_str = False
            for i, ch in enumerate(raw):
                if ch == '"' and (i == 0 or raw[i-1] != '\\'):
                    in_str = not in_str
                if not in_str:
                    if ch == '{':
                        brace_depth += 1
                    elif ch == '}':
                        brace_depth -= 1
                        if brace_depth == 1:  # closed a day object inside days array
                            last_good_pos = i + 1
            if last_good_pos > 0:
                # Reconstruct a minimal valid JSON with whatever days we parsed
                partial = raw[:last_good_pos] + "]}}"
                plan_data = json.loads(partial)
                days = plan_data.get("days", [])
                logger.info(f"Recovered {len(days)} days from partial JSON")
            else:
                raise ValueError("Cannot recover partial plan")
        except Exception:
            # Full fallback: build a mechanical plan
            days = _build_fallback_plan(start_dt, exam_dt, topics, daily_mins, review_map)
            plan_data = {"totalDays": total_days, "examDate": req.examDate, "days": days}

    # Ensure dates are correctly set (LLM sometimes gets them wrong)
    all_dates = list(date_range(start_dt, exam_dt))
    for i, day in enumerate(days):
        if i < len(all_dates):
            day["date"] = all_dates[i].isoformat()
        day["dayIndex"] = i
        # Ensure each slot has a 'done' field
        for slot in day.get("slots", []):
            slot.setdefault("done", False)
            slot.setdefault("skipped", False)

    logger.info(f"Generated study plan: {len(days)} days, {len(topics)} topics")
    return {
        "examDate": req.examDate,
        "startDate": start_dt.isoformat(),
        "totalDays": total_days,
        "dailyHours": req.dailyHours,
        "topics": topics,
        "days": days,
    }


def _build_fallback_plan(start_dt, exam_dt, topics, daily_mins, review_map):
    """Mechanical fallback if LLM JSON is malformed."""
    days = []
    all_dates = list(date_range(start_dt, exam_dt))
    total_days = len(all_dates)
    new_content_days = int(total_days * 0.7)

    for i, d in enumerate(all_dates):
        slots = []
        used_mins = 0

        # New content
        if i < new_content_days and topics:
            topic = topics[i % len(topics)]
            dur = min(45, daily_mins // 2)
            slots.append({
                "type": "new",
                "topic": topic,
                "durationMin": dur,
                "description": f"Study {topic}",
                "done": False,
                "skipped": False,
            })
            used_mins += dur

        # SM-2 reviews
        for review_topic in review_map.get(i, []):
            if used_mins + 20 <= daily_mins:
                slots.append({
                    "type": "review",
                    "topic": review_topic,
                    "durationMin": 20,
                    "description": f"Spaced repetition: {review_topic}",
                    "done": False,
                    "skipped": False,
                })
                used_mins += 20

        days.append({
            "dayIndex": i,
            "date": d.isoformat(),
            "focus": topics[i % len(topics)] if topics else "Review",
            "totalMinutes": used_mins,
            "slots": slots,
        })
    return days
