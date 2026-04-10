from fastapi import APIRouter, Depends, HTTPException, File, UploadFile
from fastapi.responses import FileResponse, Response
from sqlalchemy.orm import Session
import os
import shutil

from app.db.session import get_db
from app.models.student import Student
from app.models.classroom import Classroom
from app.schemas.student import StudentCreate, StudentResponse
from app.utils.dependencies import require_role

router = APIRouter()

STUDENT_UPLOADS_DIR = "student_uploads"
os.makedirs(STUDENT_UPLOADS_DIR, exist_ok=True)

@router.post("/", response_model=StudentResponse)
def create_student(
    student: StudentCreate,
    db: Session = Depends(get_db),
    current_user = Depends(require_role("admin"))
):
    
    classroom = db.query(Classroom).filter(Classroom.id == student.classroom_id).first()
    if not classroom:
        raise HTTPException(status_code=404, detail="Classroom not found")

    new_student = Student(
        name=student.name,
        roll_number=student.roll_number,
        email=student.email,
        phone=student.phone,
        classroom_id=student.classroom_id
    )

    db.add(new_student)
    db.commit()
    db.refresh(new_student)

    return new_student

@router.post("/{student_id}/photo", response_model=StudentResponse)
def upload_student_photo(
    student_id: int,
    file: UploadFile = File(...),
    db: Session = Depends(get_db),
    current_user = Depends(require_role("admin"))
):
    student = db.query(Student).filter(Student.id == student_id).first()
    if not student:
        raise HTTPException(status_code=404, detail="Student not found")

    photo_bytes = file.file.read()
    if not photo_bytes:
        raise HTTPException(status_code=400, detail="Uploaded photo is empty")

    # Delete old filesystem photo if this student was still on legacy storage.
    if student.photo_path and os.path.exists(student.photo_path):
        os.remove(student.photo_path)

    student.photo_filename = file.filename
    student.photo_mime_type = file.content_type or "image/jpeg"
    student.photo_data = photo_bytes
    student.photo_path = f"/students/{student_id}/photo"
    db.commit()
    db.refresh(student)

    return student


@router.get("/{student_id}/photo")
def get_student_photo(
    student_id: int,
    db: Session = Depends(get_db),
    current_user = Depends(require_role("admin"))
):
    student = db.query(Student).filter(Student.id == student_id).first()
    if not student:
        raise HTTPException(status_code=404, detail="Student not found")

    if student.photo_data:
        return Response(
            content=student.photo_data,
            media_type=student.photo_mime_type or "image/jpeg",
            headers={
                "Content-Disposition": f'inline; filename="{student.photo_filename or "student-photo.jpg"}"',
            },
        )

    if student.photo_path and os.path.exists(student.photo_path):
        return FileResponse(student.photo_path)

    raise HTTPException(status_code=404, detail="Student photo not found")

@router.get("/classroom/{classroom_id}", response_model=list[StudentResponse])
def get_students(
    classroom_id: int,
    db: Session = Depends(get_db),
    current_user = Depends(require_role("admin"))
):
    return db.query(Student).filter(Student.classroom_id == classroom_id).all()

@router.delete("/{student_id}")
def delete_student(
    student_id: int,
    db: Session = Depends(get_db),
    current_user = Depends(require_role("admin"))
):
    student = db.query(Student).filter(Student.id == student_id).first()
    if not student:
        raise HTTPException(status_code=404, detail="Student not found")
    
    # Delete photo if exists
    if student.photo_path and os.path.exists(student.photo_path):
        os.remove(student.photo_path)

    student.photo_data = None
    student.photo_filename = None
    student.photo_mime_type = None

    db.delete(student)
    db.commit()
    
    return {"message": "Student deleted successfully"}