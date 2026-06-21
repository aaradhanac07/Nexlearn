"""
Quiz generation using Groq — produces MCQ, True/False, and Short Answer questions
with difficulty scoring from RAG context.
"""
import json
import logging
from app.services.rag import retrieve_context
from app.services.groq_client import groq_complete, strip_code_fences, SMART_MODEL

logger = logging.getLogger(__name__)


def generate_quiz(
    course_id: str,
    user_id: str,
    topic: str = "",
    count: int = 5,
    difficulty: str = "mixed"
) -> dict:
    """
    Retrieves relevant context from Pinecone then uses Groq to generate
    a structured quiz with MCQ, true/false, and short-answer questions.
    """
    query = topic if topic else "key concepts and important topics"
    context = retrieve_context(query, course_id, user_id, top_k=6)

    if not context.strip():
        context = f"Generate quiz questions about topic: {topic or 'general knowledge'}"

    difficulty_instruction = {
        "easy":   "All questions should be straightforward recall questions.",
        "medium": "Mix of recall and application questions.",
        "hard":   "Focus on analysis, synthesis, and application of concepts.",
        "mixed":  "Include a mix of easy, medium, and hard questions."
    }.get(difficulty, "Include a mix of easy, medium, and hard questions.")

    prompt = f"""You are an expert quiz generator. Generate exactly {count} quiz questions from the context below.

{difficulty_instruction}

Include a mix of question types:
- MCQ (multiple_choice): 4 options, one correct
- True/False (true_false): statement that is true or false
- Short Answer (short_answer): open-ended question with a brief model answer

Return ONLY valid raw JSON (no markdown, no code blocks) in this exact format:
{{
  "questions": [
    {{
      "type": "multiple_choice",
      "question": "...",
      "options": ["A", "B", "C", "D"],
      "correctAnswer": "A",
      "explanation": "...",
      "difficulty": "easy|medium|hard",
      "conceptTag": "topic name"
    }},
    {{
      "type": "true_false",
      "question": "...",
      "correctAnswer": true,
      "explanation": "...",
      "difficulty": "easy|medium|hard",
      "conceptTag": "topic name"
    }},
    {{
      "type": "short_answer",
      "question": "...",
      "modelAnswer": "...",
      "keywords": ["key1", "key2"],
      "difficulty": "easy|medium|hard",
      "conceptTag": "topic name"
    }}
  ]
}}

Context:
{context[:5000]}"""

    raw = groq_complete(prompt, model=SMART_MODEL, temperature=0.4)
    raw = strip_code_fences(raw)

    try:
        data = json.loads(raw)
        questions = data.get("questions", [])
    except json.JSONDecodeError as e:
        logger.error(f"Quiz JSON parse error: {e}\nRaw: {raw[:500]}")
        questions = []

    # Add difficulty score (0.0-1.0) for adaptive selection
    difficulty_scores = {"easy": 0.2, "medium": 0.5, "hard": 0.9}
    for q in questions:
        q["difficultyScore"] = difficulty_scores.get(q.get("difficulty", "medium"), 0.5)

    logger.info(f"Generated {len(questions)} quiz questions for course {course_id}")
    return {"questions": questions, "courseId": course_id}


def score_short_answer(user_answer: str, model_answer: str, keywords: list) -> float:
    """Simple keyword-based scoring for short answers (0.0 - 1.0)."""
    if not user_answer.strip():
        return 0.0

    user_lower = user_answer.lower()
    matched = sum(1 for kw in keywords if kw.lower() in user_lower)
    keyword_score = matched / max(len(keywords), 1)

    length_bonus = min(0.2, len(user_answer.split()) / 50)
    return min(1.0, round(keyword_score * 0.8 + length_bonus, 2))
