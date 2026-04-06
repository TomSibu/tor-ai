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
from app.schemas.user import UserCreate, UserResponse, UserUpdate
#from app.utils.security import hash_password
from app.utils.dependencies import get_current_user, require_role

router = APIRouter()

@router.post("/register", response_model=UserResponse)
def register_user(user: UserCreate, db: Session = Depends(get_db)):
    
    # Check if email exists
    existing_user = db.query(User).filter(User.email == user.email).first()
    if existing_user:
        raise HTTPException(status_code=400, detail="Email already registered")
    
    #hashed_pw = hash_password(user.password)

    is_verified = True if user.role == "admin" else False

    new_user = User(
        name=user.name,
        email=user.email,
        password=user.password,
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

#from app.utils.security import verify_password
from app.utils.jwt import create_access_token

from app.schemas.user import UserLogin

@router.post("/login")
def login_user(user_data: UserLogin, db: Session = Depends(get_db)):
    
    user = db.query(User).filter(User.email == user_data.email).first()

    if not user:
        raise HTTPException(status_code=400, detail="Invalid email or password")

    if user_data.password != user.password:
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

@router.get("/me")
def get_me(current_user: User = Depends(get_current_user)):
    return {
        "id": current_user.id,
        "email": current_user.email,
        "role": current_user.role
    }


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
        user.password = payload.password

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
    return db.query(User).filter(User.role == "teacher", User.verified == True).all()