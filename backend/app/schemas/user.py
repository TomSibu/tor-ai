from pydantic import BaseModel, EmailStr
from typing import Literal

class UserCreate(BaseModel):
    name: str
    email: EmailStr
    password: str
    role: Literal["admin", "teacher", "classroom"]


class UserResponse(BaseModel):
    id: int
    name: str
    email: str
    role: str
    verified: bool
    profile_pic: str | None = None

    class Config:
        from_attributes = True


class UserUpdate(BaseModel):
    name: str | None = None
    email: EmailStr | None = None
    password: str | None = None
    verified: bool | None = None


class UserSelfUpdate(BaseModel):
    name: str | None = None
    email: EmailStr | None = None
    password: str | None = None
    profile_pic: str | None = None

class UserLogin(BaseModel):
    email: EmailStr
    password: str


class ForgotPasswordResetRequest(BaseModel):
    email: EmailStr
    new_password: str