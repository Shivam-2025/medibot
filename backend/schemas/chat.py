from pydantic import BaseModel
from typing import List, Optional


class SourceDocument(BaseModel):
    title: Optional[str] = None
    page: Optional[int] = None
    snippet: Optional[str] = None  # Default None to avoid "field required" error


class ChatRequest(BaseModel):
    message: str                        # renamed from prompt → message for clarity
    conversation_id: Optional[str] = None  # renamed from session_id → conversation_id


class ChatResponse(BaseModel):
    answer: str
    sources: List[SourceDocument] = []   # Default empty list to avoid missing field errors
