"""
Classroom Teaching Service

Manages autonomous classroom teaching sessions with:
- Session-based curriculum delivery
- Multi-student engagement (projector-friendly)
- Question answering with streaming
- Classroom state management
- Automatic progression through content

Designed for shared projector display and multiple students listening together.
"""

from typing import Generator, Dict, Optional, List
from datetime import datetime, timedelta
import logging
import re

from app.services.ai_service import generate_teaching_content, generate_with_ollama_streaming
from app.services.teaching_formatter import (
    build_classroom_lecture_prompt,
    build_classroom_qa_prompt,
    clean_lecture_for_display,
    chunk_lecture_into_sentences,
    format_for_tts_streaming,
)

logger = logging.getLogger(__name__)


class ClassroomTeachingSession:
    """
    Manages a single classroom teaching session.
    
    A session is:
    - Tied to a specific classroom and content
    - Autonomous (no manual topic switching)
    - Multi-student (shared projector display assumed)
    - Question-responsive (students can ask at any time)
    - Time-bound (starts at start_time, expires at expires_at)
    """
    
    def __init__(
        self,
        session_id: int,
        classroom_name: str,
        topic: str,
        content_text: str,
        teaching_script: str,
        student_count: int = None,
        ollama_model: str = "mistral",
    ):
        """
        Initialize a classroom teaching session.
        
        Args:
            session_id: Database session ID
            classroom_name: Name of classroom (for personalization)
            topic: Topic/chapter title
            content_text: Full extracted textbook content
            teaching_script: Pre-generated teaching script (from DB)
            student_count: Estimated number of students attending
            ollama_model: LLM model to use for responses
        """
        self.session_id = session_id
        self.classroom_name = classroom_name
        self.topic = topic
        self.content_text = content_text
        self.teaching_script = teaching_script
        self.student_count = student_count
        self.ollama_model = ollama_model
        
        # Session state
        self.is_active = False
        self.current_sentence_index = 0
        self.interrupted = False
        self.qa_active = False
        
        # Preprocessing
        self.sentences = chunk_lecture_into_sentences(teaching_script)
        self.tts_chunks = format_for_tts_streaming(teaching_script)
        self.clean_script = clean_lecture_for_display(teaching_script)
        
        # Track questions asked
        self.questions_answered = []
        
        logger.info(
            f"ClassroomTeachingSession initialized: "
            f"session_id={session_id}, classroom={classroom_name}, "
            f"topic={topic}, {len(self.sentences)} sentences, "
            f"students={student_count}"
        )
    
    def get_presentation_state(self) -> Dict[str, any]:
        """
        Get current presentation state for projector display.
        
        Returns:
            {
                'type': 'presentation_state',
                'session_id': int,
                'classroom_name': str,
                'topic': str,
                'clean_script': str,
                'current_sentence_index': int,
                'current_sentence': str,
                'total_sentences': int,
                'progress_percent': float,
                'is_active': bool,
                'is_interrupted': bool,
                'qa_active': bool,
            }
        """
        current_sentence = (
            self.sentences[self.current_sentence_index]
            if self.current_sentence_index < len(self.sentences)
            else ""
        )
        
        progress = (
            (self.current_sentence_index / len(self.sentences) * 100)
            if self.sentences
            else 0
        )
        
        return {
            "type": "presentation_state",
            "session_id": self.session_id,
            "classroom_name": self.classroom_name,
            "topic": self.topic,
            "full_script": self.clean_script,
            "current_sentence_index": self.current_sentence_index,
            "current_sentence": current_sentence,
            "total_sentences": len(self.sentences),
            "progress_percent": progress,
            "is_active": self.is_active,
            "is_interrupted": self.interrupted,
            "qa_active": self.qa_active,
            "questions_answered": len(self.questions_answered),
        }
    
    def answer_question(self, question: str) -> Generator[str, None, None]:
        """
        Answer a student question using streaming Q&A.
        
        CLASSROOM MODE:
        - Answers reference the topic just taught
        - Tone is encouraging and group-oriented
        - Answer is brief (2-4 sentences) to not disrupt flow
        - Structured for projector display (sentences separated)
        
        Args:
            question: Student's question (from microphone transcription)
        
        Yields:
            Individual sentences of the answer as they're generated
        """
        self.qa_active = True
        logger.info(f"[QA] Question from classroom: {question}")
        
        # Build context-aware prompt
        qa_system_prompt = build_classroom_qa_prompt()
        qa_user_prompt = (
            f"We are currently teaching '{self.topic}' in {self.classroom_name}. "
            f"A student asked: {question}\n\n"
            f"Answer this question clearly, keeping all {self.student_count} students in mind."
        )
        
        try:
            # Use streaming for responsive, sentence-level delivery
            sentence_buffer = ""
            streamed_any = False
            
            for token in generate_with_ollama_streaming(
                prompt=qa_user_prompt,
                model=self.ollama_model,
                system=qa_system_prompt,
                num_predict=128,  # Keep answers short
                temperature=0.4,  # Factual answers
                top_p=0.9,
            ):
                streamed_any = True
                sentence_buffer += token
                
                # Check if we have a complete sentence
                if re.search(r'[.!?]\s*$', sentence_buffer):
                    sentence = sentence_buffer.strip()
                    self.questions_answered.append({
                        "question": question,
                        "answer": sentence,
                        "timestamp": datetime.utcnow().isoformat(),
                    })
                    yield sentence
                    sentence_buffer = ""
            
            # Yield remaining text if any
            if sentence_buffer.strip():
                self.questions_answered.append({
                    "question": question,
                    "answer": sentence_buffer.strip(),
                    "timestamp": datetime.utcnow().isoformat(),
                })
                yield sentence_buffer.strip()

            # If stream produced nothing, try non-streaming fallback.
            if not streamed_any:
                fallback_prompt = (
                    f"{qa_system_prompt}\n\n"
                    f"Lesson topic: {self.topic}\n"
                    f"Classroom: {self.classroom_name}\n"
                    f"Student question: {question}\n\n"
                    "Give a concise classroom-friendly answer in 2-4 sentences."
                )
                fallback_answer = generate_teaching_content(fallback_prompt).strip()
                if fallback_answer:
                    self.questions_answered.append({
                        "question": question,
                        "answer": fallback_answer,
                        "timestamp": datetime.utcnow().isoformat(),
                    })
                    yield fallback_answer
                    return
        
        except Exception as e:
            logger.error(f"[QA] Error generating answer: {e}")
            # Secondary fallback: non-streaming generation path.
            try:
                fallback_prompt = (
                    f"We are teaching '{self.topic}' in {self.classroom_name}. "
                    f"A student asked: {question}\n\n"
                    "Answer clearly in 2-4 short sentences for a classroom."
                )
                fallback_answer = generate_teaching_content(fallback_prompt).strip()
                if fallback_answer:
                    self.questions_answered.append({
                        "question": question,
                        "answer": fallback_answer,
                        "timestamp": datetime.utcnow().isoformat(),
                    })
                    yield fallback_answer
                else:
                    yield (
                        "I heard your question, but I'm having trouble generating an answer right now. "
                        "Please try again in a moment while we continue today's lesson on " + self.topic + "."
                    )
            except Exception as fallback_error:
                logger.error(f"[QA] Fallback generation also failed: {fallback_error}")
                yield (
                    "I heard your question, but I'm having trouble generating an answer right now. "
                    "Please try again in a moment while we continue today's lesson on " + self.topic + "."
                )
        
        finally:
            self.qa_active = False
            logger.info(f"[QA] Question answered, returning to teaching")
    
    def advance_sentence(self) -> Optional[Dict[str, any]]:
        """
        Advance to next sentence for projector highlighting.
        
        Returns:
            Updated presentation state, or None if lesson complete
        """
        if self.current_sentence_index < len(self.sentences) - 1:
            self.current_sentence_index += 1
            return self.get_presentation_state()
        return None
    
    def go_back_sentence(self) -> Optional[Dict[str, any]]:
        """Go back to previous sentence (useful for review)."""
        if self.current_sentence_index > 0:
            self.current_sentence_index -= 1
            return self.get_presentation_state()
        return None
    
    def jump_to_sentence(self, index: int) -> Dict[str, any]:
        """Jump to specific sentence index."""
        self.current_sentence_index = max(0, min(index, len(self.sentences) - 1))
        return self.get_presentation_state()
    
    def pause(self):
        """Pause teaching (e.g., for questions or breaks)."""
        self.interrupted = True
        logger.info(f"[SESSION] Paused at sentence {self.current_sentence_index}")
    
    def resume(self):
        """Resume teaching from current position."""
        self.interrupted = False
        logger.info(f"[SESSION] Resumed from sentence {self.current_sentence_index}")
    
    def stop(self):
        """Stop teaching session."""
        self.is_active = False
        logger.info(
            f"[SESSION] Stopped. "
            f"Taught {self.current_sentence_index}/{len(self.sentences)} sentences. "
            f"Answered {len(self.questions_answered)} questions."
        )


# Global session registry (for multi-concurrent sessions)
_ACTIVE_SESSIONS: Dict[int, ClassroomTeachingSession] = {}


def create_teaching_session(
    session_id: int,
    classroom_name: str,
    topic: str,
    content_text: str,
    teaching_script: str,
    student_count: int = None,
) -> ClassroomTeachingSession:
    """
    Create and register a new classroom teaching session.
    
    Args:
        session_id: Database session ID
        classroom_name: Classroom name
        topic: Teaching topic
        content_text: Textbook content
        teaching_script: Pre-generated teaching script
        student_count: Number of students
    
    Returns:
        ClassroomTeachingSession instance
    """
    session = ClassroomTeachingSession(
        session_id=session_id,
        classroom_name=classroom_name,
        topic=topic,
        content_text=content_text,
        teaching_script=teaching_script,
        student_count=student_count,
    )
    _ACTIVE_SESSIONS[session_id] = session
    return session


def get_teaching_session(session_id: int) -> Optional[ClassroomTeachingSession]:
    """Get active teaching session by ID."""
    return _ACTIVE_SESSIONS.get(session_id)


def close_teaching_session(session_id: int):
    """Close and unregister a teaching session."""
    if session_id in _ACTIVE_SESSIONS:
        session = _ACTIVE_SESSIONS[session_id]
        session.stop()
        del _ACTIVE_SESSIONS[session_id]
        logger.info(f"[SESSION] Closed session {session_id}")


def get_active_sessions() -> List[ClassroomTeachingSession]:
    """Get all active teaching sessions."""
    return list(_ACTIVE_SESSIONS.values())
