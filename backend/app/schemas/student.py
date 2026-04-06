from pydantic import BaseModel
from typing import Optional

class StudentCreate(BaseModel):
    name: str
    roll_number: Optional[str] = None
    email: Optional[str] = None
    phone: Optional[str] = None
    classroom_id: int


class StudentResponse(BaseModel):
    id: int
    name: str
    roll_number: Optional[str] = None
    email: Optional[str] = None
    phone: Optional[str] = None
    photo_path: Optional[str] = None
    classroom_id: int

    class Config:
        from_attributes = True