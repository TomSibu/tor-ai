from fastapi import APIRouter, Depends, HTTPException, Request
from fastapi.responses import Response, StreamingResponse
from sqlalchemy.orm import Session
from datetime import datetime, timedelta
import json
import os

from app.db.session import get_db
from app.models.classroom import Classroom
from app.models.content import Content
from app.models.session import Session as SessionModel
from app.models.session_state import SessionState
from app.models.teacher_classroom import TeacherClassroom
from app.models.user import User
from app.models.generated_audio import GeneratedAudio
from app.schemas.session import SessionCreate, SessionResponse
from app.services.ai_service import build_teaching_prompt, generate_teaching_content, generate_teaching_step, split_into_chunks
from app.services.audio_service import text_to_speech
from app.utils.dependencies import get_current_user, require_role

router = APIRouter()


def _normalize_progress_value(state: dict) -> float:
    """Return progress as 0..1 regardless of service key format."""
    raw_progress = state.get("progress")
    if raw_progress is None:
        raw_progress = state.get("progress_percent", 0)

    try:
        progress = float(raw_progress)
    except (TypeError, ValueError):
        return 0.0

    # Older service payloads return percentage in 0..100.
    if progress > 1:
        progress = progress / 100.0

    if progress < 0:
        return 0.0
    if progress > 1:
        return 1.0
    return progress


def _is_teaching_session_paused(teaching_session) -> bool:
    if hasattr(teaching_session, "is_paused"):
        return bool(getattr(teaching_session, "is_paused"))
    return bool(getattr(teaching_session, "interrupted", False))


def _sanitize_tts_text(text: str) -> str:
    return (
        text.replace("**", "")
        .replace("*", "")
        .replace("\n", " ")
        .replace("\r", " ")
        .replace("  ", " ")
        .strip()
    )


def validate_user_access(session_obj: SessionModel, current_user: User, db: Session) -> None:
    if current_user.role == "admin":
        return

    if current_user.role == "teacher":
        assignment = db.query(TeacherClassroom).filter(
            TeacherClassroom.teacher_id == current_user.id,
            TeacherClassroom.classroom_id == session_obj.classroom_id,
        ).first()
        if assignment:
            return

    if current_user.role == "classroom":
        classroom = db.query(Classroom).filter(Classroom.user_id == current_user.id).first()
        if classroom and classroom.id == session_obj.classroom_id:
            return

    raise HTTPException(status_code=403, detail="Access denied")


def validate_session_timing_for_start(session_obj: SessionModel, current_user: User) -> None:
    now = datetime.utcnow()
    expires_at = session_obj.expires_at or (session_obj.start_time + timedelta(minutes=session_obj.duration))

    if now >= expires_at:
        raise HTTPException(status_code=400, detail="Session has expired")

    if current_user.role == "classroom" and now < session_obj.start_time:
        raise HTTPException(status_code=400, detail="Session has not started yet")


@router.post("/start/{session_id}")
def start_session(session_id: int, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    session_obj = db.query(SessionModel).filter(SessionModel.id == session_id).first()
    if not session_obj:
        raise HTTPException(status_code=404, detail="Session not found")

    validate_user_access(session_obj, current_user, db)
    validate_session_timing_for_start(session_obj, current_user)

    content = db.query(Content).filter(Content.id == session_obj.content_id).first()
    if not content or not content.extracted_text:
        raise HTTPException(status_code=404, detail="Content not found")

    state = db.query(SessionState).filter(SessionState.session_id == session_id).first()
    if not state:
        state = SessionState(session_id=session_id, current_index=0, status="running")
        db.add(state)
    else:
        state.current_index = 0
        state.status = "running"

    db.commit()

    chunks = split_into_chunks(content.extracted_text)
    first_chunk = chunks[0] if chunks else content.extracted_text
    teaching = generate_teaching_step(first_chunk)
    audio_path = None
    try:
        audio_path = text_to_speech(teaching, db=db)
    except Exception as e:
        print(f"TTS generation failed in /ai/start: {e}")

    return {
        "message": teaching,
        "audio": audio_path,
        "status": "waiting_for_question",
    }


@router.post("/ask")
def ask_question(
    question: str,
    content_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    content = db.query(Content).filter(Content.id == content_id).first()
    if not content or not content.extracted_text:
        raise HTTPException(status_code=404, detail="Content not found")

    prompt = f"""
Answer the question based ONLY on the following content.

Content:
{content.extracted_text[:3000]}

Question:
{question}
"""

    answer = generate_teaching_content(prompt)
    return {"answer": answer}


@router.post("/ask/{session_id}")
def ask_session_question(session_id: int, question: str, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    session_obj = db.query(SessionModel).filter(SessionModel.id == session_id).first()
    if not session_obj:
        raise HTTPException(status_code=404, detail="Session not found")

    validate_user_access(session_obj, current_user, db)

    state = db.query(SessionState).filter(SessionState.session_id == session_id).first()
    if not state:
        state = SessionState(session_id=session_id, current_index=0, status="paused")
        db.add(state)
    else:
        state.status = "paused"

    content = db.query(Content).filter(Content.id == session_obj.content_id).first()
    if not content or not content.extracted_text:
        raise HTTPException(status_code=404, detail="Content not found")

    prompt = f"""
Answer the question based on this content:

{content.extracted_text[:3000]}

Question:
{question}
"""

    answer = generate_teaching_content(prompt)
    audio_path = None
    try:
        audio_path = text_to_speech(answer, db=db)
    except Exception as e:
        print(f"TTS generation failed in /ai/ask/{{session_id}}: {e}")
    db.commit()

    return {
        "answer": answer,
        "audio": audio_path,
        "status": "waiting_for_continue",
    }


@router.post("/continue/{session_id}")
def continue_session(session_id: int, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    session_obj = db.query(SessionModel).filter(SessionModel.id == session_id).first()
    if not session_obj:
        raise HTTPException(status_code=404, detail="Session not found")

    validate_user_access(session_obj, current_user, db)

    state = db.query(SessionState).filter(SessionState.session_id == session_id).first()
    if not state:
        state = SessionState(session_id=session_id, current_index=0, status="running")
        db.add(state)
    else:
        state.status = "running"

    content = db.query(Content).filter(Content.id == session_obj.content_id).first()
    if not content or not content.extracted_text:
        raise HTTPException(status_code=404, detail="Content not found")

    chunks = split_into_chunks(content.extracted_text)
    state.current_index += 1

    if state.current_index >= len(chunks):
        db.commit()
        return {"message": "Session completed"}

    next_chunk = chunks[state.current_index]
    teaching = generate_teaching_step(next_chunk)
    audio_url = None
    try:
        audio_url = text_to_speech(teaching, db=db)
    except Exception as e:
        print(f"TTS generation failed in /ai/continue/{{session_id}}: {e}")

    db.commit()

    return {
        "message": teaching,
        "audio": audio_url,
        "status": "waiting_for_question",
    }


@router.get("/teach/{session_id}")
def teach_session(
    session_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    session_obj = db.query(SessionModel).filter(SessionModel.id == session_id).first()
    if not session_obj:
        raise HTTPException(status_code=404, detail="Session not found")

    validate_user_access(session_obj, current_user, db)

    now = datetime.utcnow()
    expires_at = session_obj.expires_at or (session_obj.start_time + timedelta(minutes=session_obj.duration))
    if now < session_obj.start_time:
        raise HTTPException(status_code=400, detail="Session has not started yet")
    if now >= expires_at:
        raise HTTPException(status_code=400, detail="Session has expired")

    # Return stored teaching content
    teaching_content = session_obj.teaching_content
    if not teaching_content:
        # Fallback: generate if not stored (for legacy sessions)
        content = db.query(Content).filter(Content.id == session_obj.content_id).first()
        if not content or not content.extracted_text:
            raise HTTPException(status_code=404, detail="Content not found")
        prompt = build_teaching_prompt(content.extracted_text)
        teaching_content = generate_teaching_content(prompt)

    return {
        "session_id": session_id,
        "teaching_content": teaching_content,
    }


# ─────────────────────────────────────────────────────────────
# CLASSROOM TEACHING DASHBOARD - New Senku Integration
# ─────────────────────────────────────────────────────────────

from app.services.teaching_service import (
    create_teaching_session,
    get_teaching_session,
    close_teaching_session,
)
from app.schemas.teaching import (
    PresentationState,
    NavigateRequest,
    QuestionRequest,
)


@router.post("/teaching/session/{session_id}/start")
def start_teaching_session(
    session_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Initialize classroom teaching session with Senku pedagogy."""
    session_obj = db.query(SessionModel).filter(SessionModel.id == session_id).first()
    if not session_obj:
        raise HTTPException(status_code=404, detail="Session not found")

    validate_user_access(session_obj, current_user, db)
    validate_session_timing_for_start(session_obj, current_user)

    classroom = db.query(Classroom).filter(Classroom.id == session_obj.classroom_id).first()
    content = db.query(Content).filter(Content.id == session_obj.content_id).first()
    topic_name = os.path.splitext(os.path.basename(content.file_path))[0] if content and content.file_path else "the topic"

    if not content:
        raise HTTPException(status_code=404, detail="Content not found")

    # Legacy session fallback: generate and persist teaching content if missing.
    if not session_obj.teaching_content:
        if not content.extracted_text:
            raise HTTPException(status_code=400, detail="Teaching content not available")
        try:
            prompt = build_teaching_prompt(
                content=content.extracted_text,
                topic=topic_name,
                classroom_name=classroom.name if classroom else "the classroom",
                student_count=getattr(classroom, "student_count", None),
            )
            session_obj.teaching_content = generate_teaching_content(prompt)
            db.commit()
            db.refresh(session_obj)
        except Exception as e:
            raise HTTPException(status_code=500, detail=f"Failed to prepare teaching content: {str(e)}")

    # Create classroom teaching session
    teaching_session = create_teaching_session(
        session_id=session_id,
        classroom_name=classroom.name if classroom else "Classroom",
        topic=topic_name or "Lesson",
        content_text=content.extracted_text or "",
        teaching_script=session_obj.teaching_content,
        student_count=getattr(classroom, "student_count", 0),
    )

    # Generate audio for the entire lecture
    audio_path = None
    try:
        clean_script = _sanitize_tts_text(session_obj.teaching_content)
        if clean_script:
            audio_path = text_to_speech(clean_script, db=db)
            print(f"[AUDIO] Generated lecture audio: {audio_path}")
    except Exception as e:
        print(f"[AUDIO] Failed to generate lecture audio: {e}")
        # Continue without audio - frontend will fall back to speech synthesis if needed

    state = teaching_session.get_presentation_state()

    return {
        "session_id": session_id,
        "status": "started",
        "current_sentence": state["current_sentence"],
        "progress": _normalize_progress_value(state),
        "total_sentences": state["total_sentences"],
        "audio_path": audio_path,  # New: return audio file path
    }


@router.get("/teaching/session/{session_id}/state")
def get_presentation_state(
    session_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Get current presentation state for projector display."""
    session_obj = db.query(SessionModel).filter(SessionModel.id == session_id).first()
    if not session_obj:
        raise HTTPException(status_code=404, detail="Session not found")

    validate_user_access(session_obj, current_user, db)

    teaching_session = get_teaching_session(session_id)
    if not teaching_session:
        raise HTTPException(status_code=400, detail="Teaching session not active")

    state = teaching_session.get_presentation_state()

    return {
        "session_id": session_id,
        "current_sentence": state["current_sentence"],
        "progress": _normalize_progress_value(state),
        "total_sentences": state["total_sentences"],
        "is_paused": _is_teaching_session_paused(teaching_session),
        "is_active": teaching_session.is_active,
    }


@router.post("/teaching/session/{session_id}/question")
def answer_classroom_question(
    session_id: int,
    question: QuestionRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Stream Q&A responses for classroom using Ollama."""
    session_obj = db.query(SessionModel).filter(SessionModel.id == session_id).first()
    if not session_obj:
        raise HTTPException(status_code=404, detail="Session not found")

    validate_user_access(session_obj, current_user, db)

    teaching_session = get_teaching_session(session_id)
    if not teaching_session:
        raise HTTPException(status_code=400, detail="Teaching session not active")

    if not question.question:
        raise HTTPException(status_code=400, detail="Question text required")

    # Pause lecture during Q&A
    teaching_session.pause()

    # Stream Q&A response using server-sent events
    def stream_qa():
        buffered_answer = ""
        try:
            for answer_chunk in teaching_session.answer_question(question.question):
                # Stream as JSON lines (newline-delimited JSON)
                event = {"type": "text", "content": answer_chunk}
                buffered_answer += answer_chunk + " "
                yield json.dumps(event) + "\n"
            
            # Signal completion and provide playable audio for the answer.
            audio_path = None
            clean_answer = _sanitize_tts_text(buffered_answer)
            if clean_answer:
                try:
                    audio_path = text_to_speech(clean_answer, db=db)
                except Exception:
                    audio_path = None

            yield json.dumps({"type": "complete", "audio_path": audio_path}) + "\n"
        except Exception as e:
            yield json.dumps({"type": "error", "content": str(e)}) + "\n"
        finally:
            # Resume lecture after Q&A complete
            teaching_session.resume()

    return StreamingResponse(stream_qa(), media_type="application/x-ndjson")


@router.post("/teaching/session/{session_id}/navigate")
def navigate_presentation(
    session_id: int,
    navigate: NavigateRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Navigate presentation (forward/back/jump)."""
    session_obj = db.query(SessionModel).filter(SessionModel.id == session_id).first()
    if not session_obj:
        raise HTTPException(status_code=404, detail="Session not found")

    validate_user_access(session_obj, current_user, db)

    teaching_session = get_teaching_session(session_id)
    if not teaching_session:
        raise HTTPException(status_code=400, detail="Teaching session not active")

    action = navigate.action  # "next", "prev", "jump"
    target = navigate.target  # sentence index for jump

    if action == "next":
        teaching_session.advance_sentence()
    elif action == "prev":
        teaching_session.go_back_sentence()
    elif action == "jump" and target is not None:
        teaching_session.jump_to_sentence(target)
    else:
        raise HTTPException(status_code=400, detail="Invalid navigation action")

    state = teaching_session.get_presentation_state()

    return {
        "current_sentence": state["current_sentence"],
        "progress": _normalize_progress_value(state),
        "total_sentences": state["total_sentences"],
    }


@router.post("/teaching/session/{session_id}/pause")
def toggle_pause(
    session_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Pause or resume presentation."""
    session_obj = db.query(SessionModel).filter(SessionModel.id == session_id).first()
    if not session_obj:
        raise HTTPException(status_code=404, detail="Session not found")

    validate_user_access(session_obj, current_user, db)

    teaching_session = get_teaching_session(session_id)
    if not teaching_session:
        raise HTTPException(status_code=400, detail="Teaching session not active")

    if _is_teaching_session_paused(teaching_session):
        teaching_session.resume()
    else:
        teaching_session.pause()

    return {
        "is_paused": _is_teaching_session_paused(teaching_session),
        "session_id": session_id,
    }


@router.post("/teaching/session/{session_id}/end")
def end_teaching_session(
    session_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """End classroom teaching session."""
    session_obj = db.query(SessionModel).filter(SessionModel.id == session_id).first()
    if not session_obj:
        raise HTTPException(status_code=404, detail="Session not found")

    validate_user_access(session_obj, current_user, db)

    close_teaching_session(session_id)

    return {
        "message": "Teaching session ended",
        "session_id": session_id,
    }


@router.get("/audio/{audio_key}")
def get_generated_audio(audio_key: str, request: Request, db: Session = Depends(get_db)):
    audio = db.query(GeneratedAudio).filter(GeneratedAudio.audio_key == audio_key).first()
    if not audio:
        raise HTTPException(status_code=404, detail="Audio not found")

    audio_bytes = bytes(audio.data)
    total_size = len(audio_bytes)
    range_header = request.headers.get("range")

    if range_header:
        try:
            range_value = range_header.strip().lower().replace("bytes=", "")
            start_str, end_str = range_value.split("-", 1)
            start = int(start_str) if start_str else 0
            end = int(end_str) if end_str else total_size - 1
            end = min(end, total_size - 1)
            if start < 0 or start > end or start >= total_size:
                raise ValueError("invalid range")

            chunk = audio_bytes[start : end + 1]
            return Response(
                content=chunk,
                status_code=206,
                media_type=audio.mime_type or "audio/wav",
                headers={
                    "Content-Range": f"bytes {start}-{end}/{total_size}",
                    "Accept-Ranges": "bytes",
                    "Content-Length": str(len(chunk)),
                },
            )
        except Exception:
            raise HTTPException(status_code=416, detail="Invalid range request")

    return Response(
        content=audio_bytes,
        media_type=audio.mime_type or "audio/wav",
        headers={
            "Accept-Ranges": "bytes",
            "Content-Length": str(total_size),
        },
    )

