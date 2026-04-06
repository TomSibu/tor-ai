from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.db.session import get_db
from app.models.student import Student
from app.models.classroom import Classroom
from app.schemas.student import StudentCreate, StudentResponse
from app.utils.dependencies import require_role

router = APIRouter()

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
        classroom_id=student.classroom_id
    )

    db.add(new_student)
    db.commit()
    db.refresh(new_student)

    return new_student

@router.get("/classroom/{classroom_id}", response_model=list[StudentResponse])
def get_students(
    classroom_id: int,
    db: Session = Depends(get_db),
    current_user = Depends(require_role("admin"))
):
    return db.query(Student).filter(Student.classroom_id == classroom_id).all()