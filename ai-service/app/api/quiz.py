"""
Quiz API endpoints — generate quizzes and score short answers.
"""
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from typing import Optional
from app.services.quiz_gen import generate_quiz, score_short_answer
import logging

logger = logging.getLogger(__name__)
router = APIRouter()


class QuizRequest(BaseModel):
    courseId: str
    userId: str
    topic: Optional[str] = ""
    count: Optional[int] = 5
    difficulty: Optional[str] = "mixed"


class ScoreRequest(BaseModel):
    userAnswer: str
    modelAnswer: str
    keywords: Optional[list] = []


@router.post("/generate")
async def generate_quiz_endpoint(body: QuizRequest):
    try:
        result = generate_quiz(
            course_id=body.courseId,
            user_id=body.userId,
            topic=body.topic or "",
            count=body.count or 5,
            difficulty=body.difficulty or "mixed"
        )
        return result
    except Exception as e:
        logger.error(f"Quiz generation failed: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=f"Quiz generation failed: {str(e)}")


@router.post("/score-short-answer")
async def score_answer(body: ScoreRequest):
    score = score_short_answer(body.userAnswer, body.modelAnswer, body.keywords or [])
    return {"score": score}
