"""Schemas for classroom teaching dashboard."""

from pydantic import BaseModel
from typing import Optional


class PresentationState(BaseModel):
    """Current state of classroom presentation."""
    session_id: int
    current_sentence: str
    progress: float  # 0.0 to 1.0
    total_sentences: int
    current_index: int
    is_paused: bool = False
    is_active: bool = True


class QuestionRequest(BaseModel):
    """Student/teacher question during lesson."""
    question: str
    student_id: Optional[int] = None


class NavigateRequest(BaseModel):
    """Navigation command for presentation."""
    action: str  # "next", "prev", "jump"
    target: Optional[int] = None  # Sentence index for jump action


class TeachingSessionResponse(BaseModel):
    """Response when starting teaching session."""
    session_id: int
    status: str
    current_sentence: str
    progress: float
    total_sentences: int


class QAStreamResponse(BaseModel):
    """Q&A stream item."""
    type: str  # "text_chunk", "complete", "error"
    content: str
    timestamp: Optional[str] = None
