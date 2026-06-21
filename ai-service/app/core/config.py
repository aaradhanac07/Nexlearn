from pydantic_settings import BaseSettings
from typing import Optional

class Settings(BaseSettings):
    gemini_api_key: Optional[str] = None
    groq_api_key: Optional[str] = None
    pinecone_api_key: str
    pinecone_index: str = "nexlearn-local"
    node_api_url: str = "http://localhost:5000"
    redis_url: Optional[str] = "redis://localhost:6379"

    class Config:
        env_file = ".env"
        extra = "ignore"  # Ignore any extra fields from .env

settings = Settings()