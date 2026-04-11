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

class UserLogin(BaseModel):
    email: EmailStr
    password: str