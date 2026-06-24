from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from app.api import ingest, chat, quiz, cards, export
from app.api import voice, plan

app = FastAPI(title="NexLearn AI Service")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(ingest.router, prefix="/ingest", tags=["ingest"])
app.include_router(chat.router,   prefix="/chat",   tags=["chat"])
app.include_router(quiz.router,   prefix="/quiz",   tags=["quiz"])
app.include_router(cards.router,  prefix="/cards",  tags=["cards"])
app.include_router(export.router, prefix="/export", tags=["export"])
app.include_router(voice.router,  prefix="/voice",  tags=["voice"])
app.include_router(plan.router,   prefix="/plan",   tags=["plan"])

@app.get("/health")
def health():
    return {"status": "ok"}