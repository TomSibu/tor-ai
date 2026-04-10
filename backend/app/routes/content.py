import os
import shutil

from fastapi import APIRouter, Depends, File, Form, HTTPException, UploadFile
from fastapi.responses import FileResponse, Response
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
from app.services.pdf_service import extract_text_from_pdf, extract_text_from_pdf_bytes
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


def _can_access_classroom(classroom_id: int, current_user: User, db: Session) -> bool:
    if current_user.role == "admin":
        return True

    if current_user.role == "teacher":
        return (
            db.query(TeacherClassroom)
            .filter(
                TeacherClassroom.teacher_id == current_user.id,
                TeacherClassroom.classroom_id == classroom_id,
            )
            .first()
            is not None
        )

    if current_user.role == "classroom":
        classroom = db.query(Classroom).filter(Classroom.user_id == current_user.id).first()
        return classroom is not None and classroom.id == classroom_id

    return False


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

    file_bytes = file.file.read()
    if not file_bytes:
        raise HTTPException(status_code=400, detail="Uploaded file is empty")

    extracted_text = extract_text_from_pdf_bytes(file_bytes)

    db_virtual_path = f"db://content/{file.filename}"

    content = Content(
        teacher_id=current_user.id,
        classroom_id=classroom_id,
        file_path=db_virtual_path,
        file_name=file.filename,
        file_mime_type=file.content_type or "application/pdf",
        file_data=file_bytes,
        extracted_text=extracted_text,
    )

    db.add(content)
    db.commit()
    db.refresh(content)

    return {"content_id": content.id}


@router.get("/{content_id}/file")
def get_content_file(
    content_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    content = db.query(Content).filter(Content.id == content_id).first()
    if not content:
        raise HTTPException(status_code=404, detail="Content not found")

    if content.classroom_id is None:
        raise HTTPException(status_code=400, detail="Content is not linked to a classroom")

    if not _can_access_classroom(content.classroom_id, current_user, db):
        raise HTTPException(status_code=403, detail="Access denied")

    if content.file_data:
        return Response(
            content=content.file_data,
            media_type=content.file_mime_type or "application/pdf",
            headers={
                "Content-Disposition": f'inline; filename="{content.file_name or "content.pdf"}"',
            },
        )

    if content.file_path and os.path.exists(content.file_path):
        return FileResponse(content.file_path)

    raise HTTPException(status_code=404, detail="Content file not available")


@router.get("/classroom/{classroom_id}", response_model=list[ContentResponse])
def list_classroom_contents(
    classroom_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    if current_user.role not in ["teacher", "admin", "classroom"]:
        raise HTTPException(status_code=403, detail="Access denied")

    if not _can_access_classroom(classroom_id, current_user, db):
        raise HTTPException(status_code=403, detail="Access denied")

    classroom = db.query(Classroom).filter(Classroom.id == classroom_id).first()
    if not classroom:
        raise HTTPException(status_code=404, detail="Classroom not found")

    query = db.query(Content).filter(Content.classroom_id == classroom_id)
    if current_user.role == "teacher":
        query = query.filter(Content.teacher_id == current_user.id)

    contents = query.order_by(Content.id.desc()).all()

    return [
        ContentResponse(
            id=content.id,
            teacher_id=content.teacher_id,
            classroom_id=content.classroom_id,
            classroom_name=classroom.name,
            file_path=content.file_path,
            file_name=content.file_name,
            file_url=f"/content/{content.id}/file",
        )
        for content in contents
    ]


@router.get("/classroom/{classroom_id}/study-materials")
def list_classroom_study_materials(
    classroom_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    if current_user.role not in ["teacher", "admin", "classroom"]:
        raise HTTPException(status_code=403, detail="Access denied")

    if not _can_access_classroom(classroom_id, current_user, db):
        raise HTTPException(status_code=403, detail="Access denied")

    classroom = db.query(Classroom).filter(Classroom.id == classroom_id).first()
    if not classroom:
        raise HTTPException(status_code=404, detail="Classroom not found")

    assignments = (
        db.query(TeacherClassroom, User)
        .join(User, User.id == TeacherClassroom.teacher_id)
        .filter(TeacherClassroom.classroom_id == classroom_id)
        .order_by(User.name.asc(), TeacherClassroom.subject.asc())
        .all()
    )

    contents = (
        db.query(Content)
        .filter(Content.classroom_id == classroom_id)
        .order_by(Content.id.desc())
        .all()
    )

    payload = []
    for assignment, teacher in assignments:
        teacher_contents = [content for content in contents if content.teacher_id == teacher.id]
        payload.append({
            "assignment_id": assignment.id,
            "subject": assignment.subject,
            "teacher_id": teacher.id,
            "teacher_name": teacher.name,
            "content_count": len(teacher_contents),
            "contents": [
                {
                    "id": content.id,
                    "file_name": content.file_name or (content.file_path.rsplit("/", 1)[-1] if content.file_path else f"Content {content.id}"),
                    "file_path": content.file_path,
                    "file_url": f"/content/{content.id}/file",
                }
                for content in teacher_contents
            ],
        })

    return {
        "classroom_id": classroom.id,
        "classroom_name": classroom.name,
        "materials": payload,
    }


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

    if current_user.role == "teacher" and content.teacher_id != current_user.id:
        raise HTTPException(status_code=403, detail="You can only delete your own uploaded content")

    session_ids = [row.id for row in db.query(SessionModel).filter(SessionModel.content_id == content.id).all()]
    if session_ids:
        db.query(Attendance).filter(Attendance.session_id.in_(session_ids)).delete(synchronize_session=False)
        db.query(SessionState).filter(SessionState.session_id.in_(session_ids)).delete(synchronize_session=False)
        db.query(SessionModel).filter(SessionModel.id.in_(session_ids)).delete(synchronize_session=False)

    db.delete(content)
    db.commit()

    return {"message": "Content deleted successfully"}
