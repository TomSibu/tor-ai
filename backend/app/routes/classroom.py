from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.db.session import get_db
from app.models.classroom import Classroom
from app.models.user import User
from app.schemas.classroom import ClassroomResponse
from app.utils.dependencies import require_role
from app.models.teacher_classroom import TeacherClassroom
from app.models.session import Session as SessionModel

router = APIRouter()

@router.post("/assign-teacher")
def assign_teacher(
    teacher_id: int,
    classroom_id: int,
    subject: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_role("admin"))
):
    teacher = db.query(User).filter(User.id == teacher_id, User.role == "teacher").first()
    if not teacher:
        raise HTTPException(status_code=404, detail="Teacher not found")

    classroom = db.query(Classroom).filter(Classroom.id == classroom_id).first()
    if not classroom:
        raise HTTPException(status_code=404, detail="Classroom not found")

    existing = db.query(TeacherClassroom).filter(
        TeacherClassroom.teacher_id == teacher_id,
        TeacherClassroom.classroom_id == classroom_id,
        TeacherClassroom.subject == subject,
    ).first()
    if existing:
        raise HTTPException(status_code=400, detail="Teacher already assigned to this class and subject")

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
    classrooms = db.query(Classroom).all()

    return [
        {
            "id": classroom.id,
            "name": classroom.name,
            "teacher_names": [
                teacher.name
                for teacher in db.query(User)
                .join(TeacherClassroom, TeacherClassroom.teacher_id == User.id)
                .filter(TeacherClassroom.classroom_id == classroom.id)
                .order_by(User.name.asc())
                .all()
            ],
        }
        for classroom in classrooms
    ]

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