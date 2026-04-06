from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.db.session import get_db
from app.models.classroom import Classroom
from app.models.user import User
from app.schemas.classroom import ClassroomCreate, ClassroomResponse
from app.utils.dependencies import require_role
from app.models.teacher_classroom import TeacherClassroom
from app.models.session import Session as SessionModel

router = APIRouter()

@router.post("/")
def create_classroom(
    name: str,
    user_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_role("admin"))
):
    # Check classroom user exists
    user = db.query(User).filter(User.id == user_id, User.role == "classroom").first()
    if not user:
        raise HTTPException(status_code=404, detail="Classroom user not found")

    # Prevent duplicate classroom for same user
    existing = db.query(Classroom).filter(Classroom.user_id == user_id).first()
    if existing:
        raise HTTPException(status_code=400, detail="Classroom already exists for this user")

    classroom = Classroom(
        name=name,
        user_id=user_id
    )

    db.add(classroom)
    db.commit()
    db.refresh(classroom)

    return classroom

@router.post("/assign-teacher")
def assign_teacher(
    teacher_id: int,
    classroom_id: int,
    subject: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_role("admin"))
):
    assignment = TeacherClassroom(
        teacher_id=teacher_id,
        classroom_id=classroom_id,
        subject=subject
    )

    db.add(assignment)
    db.commit()

    return {"message": "Assigned successfully"}

@router.get("/", response_model=list[ClassroomResponse])
def get_classrooms(
    db: Session = Depends(get_db),
    current_user: User = Depends(require_role("admin"))
):
    return db.query(Classroom).all()

from app.models.teacher_classroom import TeacherClassroom

@router.get("/my-dashboard")
def classroom_dashboard(
    db: Session = Depends(get_db),
    current_user: User = Depends(require_role("classroom"))
):
    # Find classroom linked to this user
    classroom = db.query(Classroom).filter(Classroom.user_id == current_user.id).first()

    if not classroom:
        raise HTTPException(status_code=404, detail="Classroom not found")

    # Get teacher assignments
    assignments = db.query(TeacherClassroom).filter(
        TeacherClassroom.classroom_id == classroom.id
    ).all()

    # Get sessions
    sessions = db.query(SessionModel).filter(
        SessionModel.classroom_id == classroom.id
    ).all()

    return {
        "classroom": classroom,
        "teachers": assignments,
        "sessions": sessions
    }