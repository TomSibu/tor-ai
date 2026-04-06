from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.db.session import get_db
from app.models.session import Session as SessionModel
from app.models.classroom import Classroom
from app.models.content import Content
from app.models.user import User
from app.schemas.session import SessionCreate, SessionResponse
from app.utils.dependencies import require_role

router = APIRouter()

@router.post("/", response_model=SessionResponse)
def create_session(
    session: SessionCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_role("teacher"))
):
    
    classroom = db.query(Classroom).filter(Classroom.id == session.classroom_id).first()
    if not classroom:
        raise HTTPException(status_code=404, detail="Classroom not found")

    content = db.query(Content).filter(Content.id == session.content_id).first()
    if not content:
        raise HTTPException(status_code=404, detail="Content not found")

    new_session = SessionModel(
        classroom_id=session.classroom_id,
        content_id=session.content_id,
        start_time=session.start_time,
        duration=session.duration
    )

    db.add(new_session)
    db.commit()
    db.refresh(new_session)

    return new_session