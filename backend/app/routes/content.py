import os
import shutil

from fastapi import APIRouter, Depends, File, Form, HTTPException, UploadFile
from sqlalchemy.orm import Session

from app.db.session import get_db
from app.models.classroom import Classroom
from app.models.content import Content
from app.models.attendance import Attendance
from app.models.session import Session as SessionModel
from app.models.session_state import SessionState
from app.models.teacher_classroom import TeacherClassroom
from app.models.user import User
from app.schemas.content import ContentResponse
from app.services.pdf_service import extract_text_from_pdf
from app.utils.dependencies import get_current_user

router = APIRouter()

UPLOAD_DIR = "uploads"
os.makedirs(UPLOAD_DIR, exist_ok=True)


def _validate_classroom_access(classroom_id: int, current_user: User, db: Session) -> Classroom:
    classroom = db.query(Classroom).filter(Classroom.id == classroom_id).first()
    if not classroom:
        raise HTTPException(status_code=404, detail="Classroom not found")

    if current_user.role == "admin":
        assignment = db.query(TeacherClassroom).filter(
            TeacherClassroom.teacher_id == current_user.id,
            TeacherClassroom.classroom_id == classroom_id,
        ).first()
        if assignment:
            return classroom

    if current_user.role == "teacher":
        assignment = db.query(TeacherClassroom).filter(
            TeacherClassroom.teacher_id == current_user.id,
            TeacherClassroom.classroom_id == classroom_id,
        ).first()
        if assignment:
            return classroom

    raise HTTPException(status_code=403, detail="Access denied")


@router.post("/upload")
def upload_pdf(
    classroom_id: int = Form(...),
    file: UploadFile = File(...),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    if current_user.role not in ["teacher", "admin"]:
        raise HTTPException(status_code=403, detail="Access denied")

    _validate_classroom_access(classroom_id, current_user, db)

    file_path = f"{UPLOAD_DIR}/{file.filename}"
    with open(file_path, "wb") as buffer:
        shutil.copyfileobj(file.file, buffer)

    extracted_text = extract_text_from_pdf(file_path)

    content = Content(
        teacher_id=current_user.id,
        classroom_id=classroom_id,
        file_path=file_path,
        extracted_text=extracted_text,
    )

    db.add(content)
    db.commit()
    db.refresh(content)

    return {"content_id": content.id}


@router.get("/classroom/{classroom_id}", response_model=list[ContentResponse])
def list_classroom_contents(
    classroom_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    if current_user.role not in ["teacher", "admin"]:
        raise HTTPException(status_code=403, detail="Access denied")

    _validate_classroom_access(classroom_id, current_user, db)

    return (
        db.query(Content)
        .filter(Content.classroom_id == classroom_id)
        .order_by(Content.id.desc())
        .all()
    )


@router.delete("/{content_id}")
def delete_content(
    content_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    if current_user.role not in ["teacher", "admin"]:
        raise HTTPException(status_code=403, detail="Access denied")

    content = db.query(Content).filter(Content.id == content_id).first()
    if not content:
        raise HTTPException(status_code=404, detail="Content not found")

    if content.classroom_id is None:
        raise HTTPException(status_code=400, detail="Content is not linked to a classroom")

    _validate_classroom_access(content.classroom_id, current_user, db)

    session_ids = [row.id for row in db.query(SessionModel).filter(SessionModel.content_id == content.id).all()]
    if session_ids:
        db.query(Attendance).filter(Attendance.session_id.in_(session_ids)).delete(synchronize_session=False)
        db.query(SessionState).filter(SessionState.session_id.in_(session_ids)).delete(synchronize_session=False)
        db.query(SessionModel).filter(SessionModel.id.in_(session_ids)).delete(synchronize_session=False)

    db.delete(content)
    db.commit()

    return {"message": "Content deleted successfully"}
