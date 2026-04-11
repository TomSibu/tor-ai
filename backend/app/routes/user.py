from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.db.session import get_db
from app.models.classroom import Classroom
from app.models.attendance import Attendance
from app.models.content import Content
from app.models.session import Session as SessionModel
from app.models.session_state import SessionState
from app.models.student import Student
from app.models.teacher_classroom import TeacherClassroom
from app.models.user import User
from app.schemas.user import UserCreate, UserResponse, UserUpdate, UserSelfUpdate, ForgotPasswordResetRequest
from app.utils.security import hash_password, verify_password, is_password_hashed
from app.utils.dependencies import get_current_user, require_role

router = APIRouter()

MAX_PROFILE_PIC_DATA_URL_LENGTH = 10 * 1024 * 1024
ALLOWED_PROFILE_PIC_PREFIXES = (
    "data:image/jpeg;base64,",
    "data:image/png;base64,",
    "data:image/webp;base64,",
    "data:image/gif;base64,",
)

@router.post("/register", response_model=UserResponse)
def register_user(user: UserCreate, db: Session = Depends(get_db)):
    
    # Check if email exists
    existing_user = db.query(User).filter(User.email == user.email).first()
    if existing_user:
        raise HTTPException(status_code=400, detail="Email already registered")
    
    hashed_pw = hash_password(user.password)

    is_verified = True if user.role == "admin" else False

    new_user = User(
        name=user.name,
        email=user.email,
        password=hashed_pw,
        role=user.role,
        verified=is_verified
    )

    db.add(new_user)
    db.flush()

    if user.role == "classroom":
        existing_classroom = db.query(Classroom).filter(Classroom.name == user.name).first()
        if existing_classroom:
            raise HTTPException(status_code=400, detail="Classroom name already exists")

        classroom = Classroom(
            name=user.name,
            user_id=new_user.id
        )
        db.add(classroom)

    db.commit()
    db.refresh(new_user)

    return new_user

from app.utils.jwt import create_access_token

from app.schemas.user import UserLogin

@router.post("/login")
def login_user(user_data: UserLogin, db: Session = Depends(get_db)):
    
    user = db.query(User).filter(User.email == user_data.email).first()

    if not user:
        raise HTTPException(status_code=400, detail="Invalid email or password")

    password_is_valid = verify_password(user_data.password, user.password)

    # Backward compatibility: allow existing plaintext passwords and migrate in-place.
    if not password_is_valid and user_data.password == user.password:
        user.password = hash_password(user_data.password)
        db.commit()
        db.refresh(user)
        password_is_valid = True

    if not password_is_valid:
        raise HTTPException(status_code=400, detail="Invalid email or password")
    
    if not user.verified:
        raise HTTPException(status_code=403, detail="User not verified")

    token = create_access_token({
        "user_id": user.id,
        "role": user.role
    })

    return {
        "access_token": token,
        "token_type": "bearer"
    }


@router.post("/forgot-password")
def forgot_password_reset(payload: ForgotPasswordResetRequest, db: Session = Depends(get_db)):
    user = db.query(User).filter(User.email == payload.email).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")

    user.password = hash_password(payload.new_password)
    user.verified = False

    db.commit()

    return {
        "message": "Password reset request submitted. Your account is pending admin verification."
    }

@router.get("/me", response_model=UserResponse)
def get_me(current_user: User = Depends(get_current_user)):
    return current_user


@router.put("/me", response_model=UserResponse)
def update_me(
    payload: UserSelfUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    if current_user.role not in ["admin", "teacher", "classroom"]:
        raise HTTPException(status_code=403, detail="This role cannot edit its own profile")

    user = db.query(User).filter(User.id == current_user.id).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")

    if payload.email and payload.email != user.email:
        duplicate = db.query(User).filter(User.email == payload.email, User.id != user.id).first()
        if duplicate:
            raise HTTPException(status_code=400, detail="Email already registered")
        user.email = payload.email

    if payload.name is not None:
        if user.role == "classroom":
            duplicate_classroom = db.query(Classroom).filter(Classroom.name == payload.name, Classroom.user_id != user.id).first()
            if duplicate_classroom:
                raise HTTPException(status_code=400, detail="Classroom name already exists")

            classroom = db.query(Classroom).filter(Classroom.user_id == user.id).first()
            if classroom:
                classroom.name = payload.name

        user.name = payload.name

    if payload.password is not None:
        user.password = hash_password(payload.password)

    if payload.profile_pic is not None:
        normalized_profile_pic = payload.profile_pic.strip()
        if normalized_profile_pic == "":
            user.profile_pic = None
        else:
            if not normalized_profile_pic.startswith(ALLOWED_PROFILE_PIC_PREFIXES):
                raise HTTPException(status_code=400, detail="Profile picture must be JPEG, PNG, WEBP, or GIF")

            if len(normalized_profile_pic) > MAX_PROFILE_PIC_DATA_URL_LENGTH:
                raise HTTPException(status_code=400, detail="Profile picture is too large")

            user.profile_pic = normalized_profile_pic

    db.commit()
    db.refresh(user)
    return user


@router.get("/all", response_model=list[UserResponse])
def get_all_users(
    db: Session = Depends(get_db),
    current_user: User = Depends(require_role("admin"))
):
    return db.query(User).order_by(User.id.asc()).all()

@router.get("/admin-only")
def admin_only(current_user: User = Depends(require_role("admin"))):
    return {"message": "Welcome Admin!"}

@router.get("/pending-users")
def get_pending_users(
    db: Session = Depends(get_db),
    current_user: User = Depends(require_role("admin"))
):
    return db.query(User).filter(User.verified == False).all()

@router.put("/verify/{user_id}")
def verify_user(
    user_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_role("admin"))
):
    user = db.query(User).filter(User.id == user_id).first()
    user.verified = True
    db.commit()
    return {"message": "User verified"}

@router.delete("/{user_id}")
def delete_user(
    user_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_role("admin"))
):
    if user_id == current_user.id:
        raise HTTPException(status_code=400, detail="You cannot delete your own account")

    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")

    if user.role == "teacher":
        db.query(TeacherClassroom).filter(TeacherClassroom.teacher_id == user.id).delete(synchronize_session=False)

        content_ids = [content.id for content in db.query(Content).filter(Content.teacher_id == user.id).all()]
        if content_ids:
            session_ids = [session.id for session in db.query(SessionModel).filter(SessionModel.content_id.in_(content_ids)).all()]
            if session_ids:
                db.query(Attendance).filter(Attendance.session_id.in_(session_ids)).delete(synchronize_session=False)
                db.query(SessionState).filter(SessionState.session_id.in_(session_ids)).delete(synchronize_session=False)
                db.query(SessionModel).filter(SessionModel.id.in_(session_ids)).delete(synchronize_session=False)
            db.query(Content).filter(Content.id.in_(content_ids)).delete(synchronize_session=False)

    classroom = db.query(Classroom).filter(Classroom.user_id == user.id).first()
    if classroom:
        session_ids = [session.id for session in db.query(SessionModel).filter(SessionModel.classroom_id == classroom.id).all()]
        if session_ids:
            db.query(Attendance).filter(Attendance.session_id.in_(session_ids)).delete(synchronize_session=False)
            db.query(SessionState).filter(SessionState.session_id.in_(session_ids)).delete(synchronize_session=False)
            db.query(SessionModel).filter(SessionModel.id.in_(session_ids)).delete(synchronize_session=False)
        db.query(TeacherClassroom).filter(TeacherClassroom.classroom_id == classroom.id).delete(synchronize_session=False)
        db.query(Student).filter(Student.classroom_id == classroom.id).delete(synchronize_session=False)
        db.delete(classroom)

    db.delete(user)
    db.commit()
    return {"message": "User deleted"}


@router.put("/{user_id}", response_model=UserResponse)
def update_user(
    user_id: int,
    payload: UserUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_role("admin"))
):
    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")

    if payload.email and payload.email != user.email:
        duplicate = db.query(User).filter(User.email == payload.email, User.id != user_id).first()
        if duplicate:
            raise HTTPException(status_code=400, detail="Email already registered")
        user.email = payload.email

    if payload.name is not None:
        duplicate_classroom = db.query(Classroom).filter(Classroom.name == payload.name, Classroom.user_id != user.id).first()
        if duplicate_classroom and user.role == "classroom":
            raise HTTPException(status_code=400, detail="Classroom name already exists")

        user.name = payload.name
        classroom = db.query(Classroom).filter(Classroom.user_id == user.id).first()
        if classroom:
            classroom.name = payload.name

    if payload.password is not None:
        user.password = hash_password(payload.password)

    # Safety net for admin updates on legacy rows without password changes.
    if not is_password_hashed(user.password):
        user.password = hash_password(user.password)

    if payload.verified is not None:
        user.verified = payload.verified

    db.commit()
    db.refresh(user)
    return user

@router.get("/my-classes")
def get_teacher_classes(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    if current_user.role not in ["teacher", "admin"]:
        raise HTTPException(status_code=403, detail="Access denied")

    assignments = db.query(TeacherClassroom).filter(
        TeacherClassroom.teacher_id == current_user.id
    ).all()

    classroom_ids = [assignment.classroom_id for assignment in assignments]
    classrooms = db.query(Classroom).filter(Classroom.id.in_(classroom_ids)).all() if classroom_ids else []
    classroom_map = {classroom.id: classroom.name for classroom in classrooms}

    return [
        {
            "id": assignment.id,
            "classroom_id": assignment.classroom_id,
            "classroom_name": classroom_map.get(assignment.classroom_id, "Unknown Classroom"),
            "subject": assignment.subject,
        }
        for assignment in assignments
    ]


@router.get("/teachers")
def get_teachers(
    db: Session = Depends(get_db),
    current_user: User = Depends(require_role("admin"))
):
    return (
        db.query(User)
        .filter(User.role.in_(["teacher", "admin"]), User.verified == True)
        .order_by(User.role.asc(), User.name.asc())
        .all()
    )