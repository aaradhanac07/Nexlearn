from pydantic import BaseModel
from typing import Optional

class IngestRequest(BaseModel):
    courseId: str
    userId: str
    sourceType: str
    sourceUrl: Optional[str] = None

class ChatRequest(BaseModel):
    courseId: str
    userId: str
    question: str

class QuizRequest(BaseModel):
    courseId: str
    userId: str
    count: int = 5
    difficulty: str = "medium"