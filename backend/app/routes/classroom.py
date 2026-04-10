from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.db.session import get_db
from app.models.classroom import Classroom
from app.models.user import User
from app.models.student import Student
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
    teacher = db.query(User).filter(User.id == teacher_id, User.role.in_(["teacher", "admin"])).first()
    if not teacher:
        raise HTTPException(status_code=404, detail="Teacher/Admin user not found")

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


@router.get("/subjects")
def list_subject_suggestions(
    db: Session = Depends(get_db),
    current_user: User = Depends(require_role("admin"))
):
    rows = (
        db.query(TeacherClassroom.subject)
        .filter(TeacherClassroom.subject.isnot(None), TeacherClassroom.subject != "")
        .all()
    )

    seen = set()
    subjects = []
    for (raw_subject,) in rows:
        subject = (raw_subject or "").strip()
        if not subject:
            continue

        dedupe_key = subject.casefold()
        if dedupe_key in seen:
            continue

        seen.add(dedupe_key)
        subjects.append(subject)

    subjects.sort(key=lambda value: value.casefold())
    return subjects

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

@router.get("/users-with-classrooms")
def get_classroom_users(
    db: Session = Depends(get_db),
    current_user: User = Depends(require_role("admin"))
):
    """Get classrooms with linked classroom-user metadata for admin management."""
    classrooms = db.query(Classroom).order_by(Classroom.name.asc()).all()

    result = []
    for classroom in classrooms:
        user = None
        if classroom.user_id is not None:
            user = db.query(User).filter(User.id == classroom.user_id).first()

        # Backward-compat fallback: match a classroom role user by name.
        if not user:
            user = db.query(User).filter(
                User.role == "classroom",
                User.name == classroom.name,
            ).first()

        student_count = db.query(Student).filter(Student.classroom_id == classroom.id).count()
        teacher_count = db.query(TeacherClassroom).filter(TeacherClassroom.classroom_id == classroom.id).count()

        result.append({
            "user_id": user.id if user else None,
            "user_name": user.name if user else "Unlinked classroom user",
            "user_email": user.email if user else "—",
            "classroom_id": classroom.id,
            "classroom_name": classroom.name,
            "student_count": student_count,
            "teacher_count": teacher_count,
        })

    return result

@router.get("/details/{classroom_id}")
def get_classroom_details(
    classroom_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_role("admin"))
):
    """Get classroom details including students and teacher assignments"""
    classroom = db.query(Classroom).filter(Classroom.id == classroom_id).first()
    if not classroom:
        raise HTTPException(status_code=404, detail="Classroom not found")
    
    students = db.query(Student).filter(Student.classroom_id == classroom_id).all()
    assignments = db.query(TeacherClassroom).filter(TeacherClassroom.classroom_id == classroom_id).all()
    
    teacher_details = []
    for assignment in assignments:
        teacher = db.query(User).filter(User.id == assignment.teacher_id).first()
        if teacher:
            teacher_details.append({
                "id": assignment.id,
                "teacher_id": teacher.id,
                "teacher_name": teacher.name,
                "subject": assignment.subject
            })
    
    students_payload = [
        {
            "id": student.id,
            "name": student.name,
            "roll_number": student.roll_number,
            "email": student.email,
            "phone": student.phone,
            # Expose a URL/path only; never include raw photo_data bytes in JSON payloads.
            "photo_path": student.photo_path,
            "classroom_id": student.classroom_id,
        }
        for student in students
    ]

    return {
        "classroom": {
            "id": classroom.id,
            "name": classroom.name,
            "user_id": classroom.user_id,
        },
        "students": students_payload,
        "teachers": teacher_details,
    }

from app.models.teacher_classroom import TeacherClassroom

@router.delete("/assignments/{assignment_id}")
def remove_teacher_assignment(
    assignment_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_role("admin"))
):
    """Remove a teacher assignment from a classroom"""
    assignment = db.query(TeacherClassroom).filter(TeacherClassroom.id == assignment_id).first()
    if not assignment:
        raise HTTPException(status_code=404, detail="Assignment not found")
    
    db.delete(assignment)
    db.commit()
    
    return {"message": "Assignment removed successfully"}

@router.get("/my-dashboard")
def classroom_dashboard(
    db: Session = Depends(get_db),
    current_user: User = Depends(require_role("classroom"))
):
    from app.models.user import User as UserModel
    
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
    ).order_by(SessionModel.start_time.desc()).all()

    # Get students
    students = db.query(Student).filter(Student.classroom_id == classroom.id).all()

    # Format teacher assignments with proper data
    teachers_data = []
    for assignment in assignments:
        teacher_user = db.query(UserModel).filter(UserModel.id == assignment.teacher_id).first()
        if teacher_user:
            teachers_data.append({
                "id": assignment.id,
                "teacher_id": assignment.teacher_id,
                "teacher_name": teacher_user.name,
                "subject": assignment.subject,
            })

    # Format sessions data
    sessions_data = []
    for session in sessions:
        from datetime import datetime
        status = "upcoming"
        if session.start_time and session.expires_at:
            now = datetime.utcnow()
            if now >= session.expires_at:
                status = "expired"
            elif now >= session.start_time:
                status = "live"
        
        sessions_data.append({
            "id": session.id,
            "start_time": session.start_time.isoformat() if session.start_time else None,
            "expires_at": session.expires_at.isoformat() if session.expires_at else None,
            "duration": session.duration,
            "status": status,
        })

    return {
        "classroom": {
            "id": classroom.id,
            "name": classroom.name,
            "user_id": classroom.user_id,
        },
        "teachers": teachers_data,
        "sessions": sessions_data,
        "student_count": len(students),
        "total_teachers": len(teachers_data),
        "total_sessions": len(sessions_data),
    }