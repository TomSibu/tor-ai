from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.db.session import get_db
from app.models.attendance import Attendance
from app.models.classroom import Classroom
from app.models.session import Session as SessionModel
from app.models.student import Student
from app.models.teacher_classroom import TeacherClassroom
from app.models.user import User
from app.schemas.attendance import AttendanceScanReport
from app.services.attendance_service import capture_session_attendance
from app.utils.dependencies import get_current_user

router = APIRouter()


def _validate_session_access(session_obj: SessionModel, current_user: User, db: Session) -> None:
    if current_user.role == "admin":
        return

    if current_user.role == "teacher":
        from app.models.teacher_classroom import TeacherClassroom

        assignment = db.query(TeacherClassroom).filter(
            TeacherClassroom.teacher_id == current_user.id,
            TeacherClassroom.classroom_id == session_obj.classroom_id,
        ).first()
        if assignment:
            return

    if current_user.role == "classroom":
        classroom = db.query(Classroom).filter(Classroom.user_id == current_user.id).first()
        if classroom and classroom.id == session_obj.classroom_id:
            return

    raise HTTPException(status_code=403, detail="Access denied")


def _validate_classroom_access(classroom_id: int, current_user: User, db: Session) -> Classroom:
    classroom = db.query(Classroom).filter(Classroom.id == classroom_id).first()
    if not classroom:
        raise HTTPException(status_code=404, detail="Classroom not found")

    if current_user.role == "admin":
        return classroom

    if current_user.role == "teacher":
        assignment = db.query(TeacherClassroom).filter(
            TeacherClassroom.teacher_id == current_user.id,
            TeacherClassroom.classroom_id == classroom_id,
        ).first()
        if assignment:
            return classroom

    if current_user.role == "classroom" and classroom.user_id == current_user.id:
        return classroom

    raise HTTPException(status_code=403, detail="Access denied")


def _build_session_wise_payload(classroom: Classroom, db: Session) -> dict:
    from app.models.content import Content
    from app.models.teacher_classroom import TeacherClassroom
    from app.models.user import User as UserModel

    students = db.query(Student).filter(Student.classroom_id == classroom.id).order_by(Student.name.asc()).all()
    sessions = db.query(SessionModel).filter(SessionModel.classroom_id == classroom.id).order_by(SessionModel.start_time.desc()).all()

    session_ids = [session.id for session in sessions]
    attendance_rows = db.query(Attendance).filter(Attendance.session_id.in_(session_ids)).all() if session_ids else []

    by_session: dict[int, dict[int, Attendance]] = {}
    for row in attendance_rows:
        by_session.setdefault(row.session_id, {})[row.student_id] = row

    session_items = []
    for session in sessions:
        present_students = []
        absent_students = []

        rows_for_session = by_session.get(session.id, {})
        for student in students:
            record = rows_for_session.get(student.id)
            if record and record.status == "present":
                present_students.append({
                    "id": student.id,
                    "name": student.name,
                    "confidence": record.confidence,
                })
            else:
                absent_students.append({
                    "id": student.id,
                    "name": student.name,
                })

        # Get session metadata (subject, teacher name)
        content = db.query(Content).filter(Content.id == session.content_id).first()
        teacher_assignment = db.query(TeacherClassroom).filter(
            TeacherClassroom.classroom_id == session.classroom_id
        ).first()
        teacher_user = None
        if teacher_assignment:
            teacher_user = db.query(UserModel).filter(UserModel.id == teacher_assignment.teacher_id).first()

        session_name = f"{teacher_assignment.subject} - {classroom.name}" if teacher_assignment and teacher_assignment.subject else f"Session #{session.id}"

        session_items.append({
            "session_id": session.id,
            "session_name": session_name,
            "subject": teacher_assignment.subject if teacher_assignment else None,
            "teacher_name": teacher_user.name if teacher_user else None,
            "start_time": session.start_time.isoformat() if session.start_time else None,
            "total_students": len(students),
            "present_count": len(present_students),
            "absent_count": len(absent_students),
            "present_students": present_students,
            "absent_students": absent_students,
        })

    return {
        "classroom_id": classroom.id,
        "classroom_name": classroom.name,
        "total_students": len(students),
        "sessions": session_items,
    }


def _build_student_wise_payload(classroom: Classroom, db: Session) -> dict:
    from app.models.teacher_classroom import TeacherClassroom
    from app.models.user import User as UserModel

    students = db.query(Student).filter(Student.classroom_id == classroom.id).order_by(Student.name.asc()).all()
    sessions = db.query(SessionModel).filter(SessionModel.classroom_id == classroom.id).order_by(SessionModel.start_time.desc()).all()

    session_ids = [session.id for session in sessions]
    attendance_rows = db.query(Attendance).filter(Attendance.session_id.in_(session_ids)).all() if session_ids else []

    by_student_and_session: dict[tuple[int, int], Attendance] = {
        (row.student_id, row.session_id): row for row in attendance_rows
    }

    session_time_map = {
        session.id: session.start_time.isoformat() if session.start_time else None for session in sessions
    }

    session_metadata_map = {}
    for session in sessions:
        teacher_assignment = db.query(TeacherClassroom).filter(
            TeacherClassroom.classroom_id == session.classroom_id
        ).first()
        teacher_user = None
        if teacher_assignment:
            teacher_user = db.query(UserModel).filter(UserModel.id == teacher_assignment.teacher_id).first()

        session_name = f"{teacher_assignment.subject} - {classroom.name}" if teacher_assignment and teacher_assignment.subject else f"Session #{session.id}"
        session_metadata_map[session.id] = {
            "session_name": session_name,
            "subject": teacher_assignment.subject if teacher_assignment else None,
        }

    student_items = []
    for student in students:
        records = []
        present_sessions = 0

        for session in sessions:
            row = by_student_and_session.get((student.id, session.id))
            status = "present" if row and row.status == "present" else "absent"
            if status == "present":
                present_sessions += 1

            metadata = session_metadata_map.get(session.id, {})
            records.append({
                "session_id": session.id,
                "session_name": metadata.get("session_name"),
                "subject": metadata.get("subject"),
                "start_time": session_time_map.get(session.id),
                "status": status,
                "confidence": row.confidence if row else None,
            })

        total_sessions = len(sessions)
        absent_sessions = total_sessions - present_sessions
        percentage = round((present_sessions / total_sessions) * 100.0, 2) if total_sessions > 0 else 0.0

        student_items.append({
            "student_id": student.id,
            "student_name": student.name,
            "present_sessions": present_sessions,
            "absent_sessions": absent_sessions,
            "attendance_percentage": percentage,
            "records": records,
        })

    return {
        "classroom_id": classroom.id,
        "classroom_name": classroom.name,
        "total_sessions": len(sessions),
        "students": student_items,
    }


@router.post("/capture/{session_id}", response_model=AttendanceScanReport)
def capture_attendance(
    session_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    session_obj = db.query(SessionModel).filter(SessionModel.id == session_id).first()
    if not session_obj:
        raise HTTPException(status_code=404, detail="Session not found")

    _validate_session_access(session_obj, current_user, db)
    return capture_session_attendance(db=db, session_id=session_id)


@router.get("/session/{session_id}")
def get_session_attendance(
    session_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    session_obj = db.query(SessionModel).filter(SessionModel.id == session_id).first()
    if not session_obj:
        raise HTTPException(status_code=404, detail="Session not found")

    _validate_session_access(session_obj, current_user, db)

    records = db.query(Attendance).filter(Attendance.session_id == session_id).all()
    return records


@router.get("/classroom/{classroom_id}/session-wise")
def get_classroom_attendance_session_wise(
    classroom_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    classroom = _validate_classroom_access(classroom_id, current_user, db)
    return _build_session_wise_payload(classroom, db)


@router.get("/classroom/{classroom_id}/student-wise")
def get_classroom_attendance_student_wise(
    classroom_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    classroom = _validate_classroom_access(classroom_id, current_user, db)
    return _build_student_wise_payload(classroom, db)


@router.get("/my-classroom/session-wise")
def get_my_classroom_attendance_session_wise(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    if current_user.role != "classroom":
        raise HTTPException(status_code=403, detail="Access denied")

    classroom = db.query(Classroom).filter(Classroom.user_id == current_user.id).first()
    if not classroom:
        raise HTTPException(status_code=404, detail="Classroom not found")

    return _build_session_wise_payload(classroom, db)


@router.get("/my-classroom/student-wise")
def get_my_classroom_attendance_student_wise(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    if current_user.role != "classroom":
        raise HTTPException(status_code=403, detail="Access denied")

    classroom = db.query(Classroom).filter(Classroom.user_id == current_user.id).first()
    if not classroom:
        raise HTTPException(status_code=404, detail="Classroom not found")

    return _build_student_wise_payload(classroom, db)
