"""
Cards API — SM-2 review endpoint and knowledge graph generation.
"""
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from typing import Optional
from app.services.sm2 import compute_sm2
from app.services.knowledge_graph import extract_knowledge_graph
import logging

logger = logging.getLogger(__name__)
router = APIRouter()


class ReviewRequest(BaseModel):
    easeFactor: float = 2.5
    interval: int = 1
    repetitions: int = 0
    rating: int  # 0=Again, 1=Hard, 2=Good, 3=Easy


class KnowledgeGraphRequest(BaseModel):
    courseId: str
    fullText: str


@router.post("/review")
async def review_card(body: ReviewRequest):
    """
    Compute new SM-2 values for a card after a review.
    Returns updated ease_factor, interval, repetitions, next_review_at.
    """
    try:
        result = compute_sm2(
            ease_factor=body.easeFactor,
            interval=body.interval,
            repetitions=body.repetitions,
            rating=body.rating
        )
        return result
    except Exception as e:
        logger.error(f"SM-2 computation failed: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=f"SM-2 failed: {str(e)}")


@router.post("/knowledge-graph")
async def build_knowledge_graph(body: KnowledgeGraphRequest):
    """
    Extract concept nodes and edges from course full text.
    """
    try:
        result = extract_knowledge_graph(body.fullText, body.courseId)
        return result
    except Exception as e:
        logger.error(f"Knowledge graph failed: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=f"Knowledge graph failed: {str(e)}")