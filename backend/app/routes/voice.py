from fastapi import APIRouter, UploadFile, File, Depends
from sqlalchemy.orm import Session

from app.db.session import get_db
from app.services.speech_service import speech_to_text
from app.services.ai_service import generate_teaching_content
from app.services.audio_service import text_to_speech
from app.models.session import Session as SessionModel
from app.models.content import Content
from app.models.user import User
from app.utils.dependencies import get_current_user, require_role
from app.routes.ai import validate_user_access

router = APIRouter()

@router.post("/ask-voice")
def ask_voice(
    file: UploadFile = File(...),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    audio_bytes = file.file.read()

    # Convert speech → text
    question = speech_to_text(audio_bytes)

    # Get session content (VERY IMPORTANT)
    session_id = 1  # TEMP for now (we'll improve later)

    session = db.query(SessionModel).filter(SessionModel.id == session_id).first()
    validate_user_access(session, current_user, db)
    content = db.query(Content).filter(Content.id == session.content_id).first()

    # Build contextual prompt
    prompt = f"""
    Answer the question based ONLY on the following classroom content.

    Content:
    {content.extracted_text[:3000]}

    Question:
    {question}
    """    
    # Send to AI
    answer = generate_teaching_content(question)

    # Convert answer → audio
    audio_file = text_to_speech(answer, db=db)

    return {
        "transcribed_text": question,
        "answer": answer,
        "audio": audio_file
    }