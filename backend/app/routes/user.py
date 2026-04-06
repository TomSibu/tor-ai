from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.db.session import get_db
from app.models.user import User
from app.schemas.user import UserCreate, UserResponse
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
    user = db.query(User).filter(User.id == user_id).first()
    db.delete(user)
    db.commit()
    return {"message": "User deleted"}

from app.models.teacher_classroom import TeacherClassroom

@router.get("/my-classes")
def get_teacher_classes(
    db: Session = Depends(get_db),
    current_user: User = Depends(require_role("teacher"))
):
    return db.query(TeacherClassroom).filter(
        TeacherClassroom.teacher_id == current_user.id
    ).all()