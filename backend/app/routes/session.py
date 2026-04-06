from datetime import datetime, timedelta

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.db.session import get_db
from app.models.attendance import Attendance
from app.models.classroom import Classroom
from app.models.content import Content
from app.models.session import Session as SessionModel
from app.models.session_state import SessionState
from app.models.teacher_classroom import TeacherClassroom
from app.models.user import User
from app.schemas.session import SessionCreate, SessionManageResponse, SessionResponse, SessionUpdate
from app.utils.dependencies import get_current_user

router = APIRouter()


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


def _get_session_status(session_obj: SessionModel) -> str:
    now = datetime.utcnow()
    start_time = session_obj.start_time
    expires_at = session_obj.expires_at or (start_time + timedelta(minutes=session_obj.duration))

    if now < start_time:
        return "upcoming"
    if start_time <= now < expires_at:
        return "live"
    return "expired"


def _build_session_manage_payload(session_obj: SessionModel, db: Session) -> SessionManageResponse:
    content = db.query(Content).filter(Content.id == session_obj.content_id).first()
    classroom = db.query(Classroom).filter(Classroom.id == session_obj.classroom_id).first()

    teacher = None
    if content and content.teacher_id:
        teacher = db.query(User).filter(User.id == content.teacher_id).first()

    subject = None
    if teacher and classroom:
        assignment = db.query(TeacherClassroom).filter(
            TeacherClassroom.teacher_id == teacher.id,
            TeacherClassroom.classroom_id == classroom.id,
        ).first()
        if assignment:
            subject = assignment.subject

    session_name = None
    if classroom:
        if subject:
            session_name = f"{subject} - {classroom.name}"
        else:
            session_name = f"Session - {classroom.name}"

    return SessionManageResponse(
        id=session_obj.id,
        classroom_id=session_obj.classroom_id,
        classroom_name=classroom.name if classroom else None,
        content_id=session_obj.content_id,
        content_file_path=content.file_path if content else None,
        teacher_id=teacher.id if teacher else None,
        teacher_name=teacher.name if teacher else None,
        subject=subject,
        session_name=session_name,
        start_time=session_obj.start_time,
        duration=session_obj.duration,
        expires_at=session_obj.expires_at or (session_obj.start_time + timedelta(minutes=session_obj.duration)),
        status=_get_session_status(session_obj),
    )


@router.post("/", response_model=SessionResponse)
def create_session(
    session: SessionCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    if current_user.role not in ["teacher", "admin"]:
        raise HTTPException(status_code=403, detail="Access denied")

    _validate_classroom_access(session.classroom_id, current_user, db)

    content = db.query(Content).filter(Content.id == session.content_id).first()
    if not content:
        raise HTTPException(status_code=404, detail="Content not found")

    if content.classroom_id != session.classroom_id:
        raise HTTPException(status_code=400, detail="Content must belong to the same classroom")

    minimum_expiry = session.start_time + timedelta(minutes=session.duration)
    if session.expires_at <= minimum_expiry:
        raise HTTPException(
            status_code=400,
            detail="Expiry time must be greater than start time + duration",
        )

    new_session = SessionModel(
        classroom_id=session.classroom_id,
        content_id=session.content_id,
        start_time=session.start_time,
        duration=session.duration,
        expires_at=session.expires_at,
    )

    db.add(new_session)
    db.commit()
    db.refresh(new_session)

    return new_session


@router.get("/classroom/{classroom_id}", response_model=list[SessionManageResponse])
def list_classroom_sessions(
    classroom_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    if current_user.role not in ["teacher", "admin"]:
        raise HTTPException(status_code=403, detail="Access denied")

    _validate_classroom_access(classroom_id, current_user, db)

    sessions = (
        db.query(SessionModel)
        .filter(SessionModel.classroom_id == classroom_id)
        .order_by(SessionModel.start_time.desc())
        .all()
    )

    return [_build_session_manage_payload(session, db) for session in sessions]


@router.get("/{session_id}", response_model=SessionManageResponse)
def get_session_by_id(
    session_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    session_obj = db.query(SessionModel).filter(SessionModel.id == session_id).first()
    if not session_obj:
        raise HTTPException(status_code=404, detail="Session not found")

    if current_user.role in ["teacher", "admin"]:
        _validate_classroom_access(session_obj.classroom_id, current_user, db)
    elif current_user.role == "classroom":
        classroom = db.query(Classroom).filter(Classroom.user_id == current_user.id).first()
        if not classroom or classroom.id != session_obj.classroom_id:
            raise HTTPException(status_code=403, detail="Access denied")
    else:
        raise HTTPException(status_code=403, detail="Access denied")

    return _build_session_manage_payload(session_obj, db)


@router.get("/my-classroom/list", response_model=list[SessionManageResponse])
def list_my_classroom_sessions(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    if current_user.role != "classroom":
        raise HTTPException(status_code=403, detail="Access denied")

    classroom = db.query(Classroom).filter(Classroom.user_id == current_user.id).first()
    if not classroom:
        raise HTTPException(status_code=404, detail="Classroom not found")

    sessions = (
        db.query(SessionModel)
        .filter(SessionModel.classroom_id == classroom.id)
        .order_by(SessionModel.start_time.desc())
        .all()
    )

    return [_build_session_manage_payload(session, db) for session in sessions]


@router.put("/{session_id}", response_model=SessionResponse)
def update_session(
    session_id: int,
    payload: SessionUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    if current_user.role not in ["teacher", "admin"]:
        raise HTTPException(status_code=403, detail="Access denied")

    session_obj = db.query(SessionModel).filter(SessionModel.id == session_id).first()
    if not session_obj:
        raise HTTPException(status_code=404, detail="Session not found")

    _validate_classroom_access(session_obj.classroom_id, current_user, db)

    content = db.query(Content).filter(Content.id == payload.content_id).first()
    if not content:
        raise HTTPException(status_code=404, detail="Content not found")

    if content.classroom_id != session_obj.classroom_id:
        raise HTTPException(status_code=400, detail="Content must belong to the same classroom")

    minimum_expiry = payload.start_time + timedelta(minutes=payload.duration)
    if payload.expires_at <= minimum_expiry:
        raise HTTPException(
            status_code=400,
            detail="Expiry time must be greater than start time + duration",
        )

    session_obj.content_id = payload.content_id
    session_obj.start_time = payload.start_time
    session_obj.duration = payload.duration
    session_obj.expires_at = payload.expires_at

    db.commit()
    db.refresh(session_obj)

    return session_obj


@router.delete("/{session_id}")
def delete_session(
    session_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    if current_user.role not in ["teacher", "admin"]:
        raise HTTPException(status_code=403, detail="Access denied")

    session_obj = db.query(SessionModel).filter(SessionModel.id == session_id).first()
    if not session_obj:
        raise HTTPException(status_code=404, detail="Session not found")

    _validate_classroom_access(session_obj.classroom_id, current_user, db)

    db.query(Attendance).filter(Attendance.session_id == session_id).delete(synchronize_session=False)
    db.query(SessionState).filter(SessionState.session_id == session_id).delete(synchronize_session=False)
    db.delete(session_obj)
    db.commit()

    return {"message": "Session deleted successfully"}
