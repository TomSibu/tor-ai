from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from datetime import datetime, timedelta

from app.db.session import get_db
from app.models.classroom import Classroom
from app.models.content import Content
from app.models.session import Session as SessionModel
from app.models.session_state import SessionState
from app.models.teacher_classroom import TeacherClassroom
from app.models.user import User
from app.schemas.session import SessionCreate, SessionResponse
from app.services.ai_service import build_teaching_prompt, generate_teaching_content, generate_teaching_step, split_into_chunks
from app.services.audio_service import text_to_speech
from app.utils.dependencies import get_current_user, require_role

router = APIRouter()


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
    audio_path = text_to_speech(teaching)

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
    audio_path = text_to_speech(answer)
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
    audio_file = text_to_speech(teaching)
    audio_url = f"http://127.0.0.1:8000/{audio_file}"

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

    content = db.query(Content).filter(Content.id == session_obj.content_id).first()
    if not content or not content.extracted_text:
        raise HTTPException(status_code=404, detail="Content not found")

    prompt = build_teaching_prompt(content.extracted_text)
    ai_output = generate_teaching_content(prompt)

    return {
        "session_id": session_id,
        "teaching_content": ai_output,
    }
