from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.db.session import get_db
from app.models.session import Session as SessionModel
from app.models.content import Content
from app.utils.dependencies import get_current_user, require_role
from app.services.ai_service import generate_teaching_content, build_teaching_prompt

from app.models.session_state import SessionState
from app.services.ai_service import split_into_chunks, generate_teaching_step
from app.services.audio_service import text_to_speech
from app.models.user import User
from app.models.classroom import Classroom
from app.routes import session
from app.schemas import classroom

router = APIRouter()

def validate_user_access(session, current_user, db):
    # Admin → full access
    if current_user.role == "admin":
        return

    # Teacher → check assignment
    if current_user.role == "teacher":
        from app.models.teacher_classroom import TeacherClassroom

        assignment = db.query(TeacherClassroom).filter(
            TeacherClassroom.teacher_id == current_user.id,
            TeacherClassroom.classroom_id == session.classroom_id
        ).first()

        if assignment:
            return

    # Classroom → check ownership
    if current_user.role == "classroom":
        from app.models.classroom import Classroom

        classroom = db.query(Classroom).filter(
            Classroom.user_id == current_user.id
        ).first()

        if classroom and classroom.id == session.classroom_id:
            return

    raise HTTPException(status_code=403, detail="Access denied")

@router.get("/teach/{session_id}")
def teach_session(
    session_id: int,
    db: Session = Depends(get_db),
    current_user = Depends(get_current_user)
):
    
    session = db.query(SessionModel).filter(SessionModel.id == session_id).first()
    validate_user_access(session, current_user, db)
    if not session:
        return {"error": "Session not found"}
    
    # Validate classroom ownership
    classroom = db.query(Classroom).filter(Classroom.user_id == current_user.id).first()

    if not classroom or classroom.id != session.classroom_id:
        raise HTTPException(status_code=403, detail="Not your classroom session")

    content = db.query(Content).filter(Content.id == session.content_id).first()

    prompt = build_teaching_prompt(content.extracted_text)

    ai_output = generate_teaching_content(prompt)

    return {
        "session_id": session_id,
        "teaching_content": ai_output
    }

@router.post("/ask")
def ask_question(
    question: str,
    content_id: int,
    db: Session = Depends(get_db),
    current_user = Depends(get_current_user)
):
    
    content = db.query(Content).filter(Content.id == content_id).first()

    prompt = f"""
Answer the question based ONLY on the following content.

Content:
{content.extracted_text[:3000]}

Question:
{question}
"""

    answer = generate_teaching_content(prompt)

    return {"answer": answer}

@router.post("/start/{session_id}")
def start_session(session_id: int, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):

    classroom = db.query(Classroom).filter(Classroom.user_id == current_user.id).first()

    if not classroom or classroom.id != session.classroom_id:
        raise HTTPException(status_code=403, detail="Not your classroom session")
        
    session = db.query(SessionModel).filter(SessionModel.id == session_id).first()
    validate_user_access(session, current_user, db)
    content = db.query(Content).filter(Content.id == session.content_id).first()

    chunks = split_into_chunks(content.extracted_text)

    state = SessionState(
        session_id=session_id,
        current_index=0,
        status="running"
    )

    db.add(state)
    db.commit()

    first_chunk = chunks[0]

    teaching = generate_teaching_step(first_chunk)
    audio_path = text_to_speech(teaching)

    return {
        "message": teaching,
        "audio": audio_path,
        "status": "waiting_for_question"
    }

@router.post("/ask/{session_id}")
def ask_question(session_id: int, question: str, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):


    session = db.query(SessionModel).filter(SessionModel.id == session_id).first()
    validate_user_access(session, current_user, db)

    classroom = db.query(Classroom).filter(Classroom.user_id == current_user.id).first()

    if not classroom or classroom.id != session.classroom_id:
        raise HTTPException(status_code=403, detail="Not your classroom session")
    state = db.query(SessionState).filter(SessionState.session_id == session_id).first()
    state.status = "paused"

    session = db.query(SessionModel).filter(SessionModel.id == session_id).first()
    content = db.query(Content).filter(Content.id == session.content_id).first()

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
        "status": "waiting_for_continue"
    }

@router.post("/continue/{session_id}")
def continue_session(session_id: int, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):


    classroom = db.query(Classroom).filter(Classroom.user_id == current_user.id).first()

    if not classroom or classroom.id != session.classroom_id:
        raise HTTPException(status_code=403, detail="Not your classroom session")
    state = db.query(SessionState).filter(SessionState.session_id == session_id).first()

    if state.status == "paused":
        state.status = "running"

    session = db.query(SessionModel).filter(SessionModel.id == session_id).first()
    validate_user_access(session, current_user, db)
    content = db.query(Content).filter(Content.id == session.content_id).first()

    chunks = split_into_chunks(content.extracted_text)

    state.current_index += 1

    if state.current_index >= len(chunks):
        return {"message": "Session completed"}

    next_chunk = chunks[state.current_index]
    teaching = generate_teaching_step(next_chunk)
    audio_file = text_to_speech(teaching)
    audio_url = f"http://127.0.0.1:8000/{audio_file}"

    db.commit()

    return {
        "message": teaching,
        "audio": audio_url,
        "status": "waiting_for_question"
    }