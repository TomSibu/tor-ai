from pydantic import BaseModel
from datetime import datetime

class SessionCreate(BaseModel):
    classroom_id: int
    content_id: int
    start_time: datetime
    duration: int
    expires_at: datetime


class SessionResponse(BaseModel):
    id: int
    classroom_id: int
    content_id: int
    start_time: datetime
    duration: int
    expires_at: datetime

    class Config:
        from_attributes = True


class SessionUpdate(BaseModel):
    content_id: int
    start_time: datetime
    duration: int
    expires_at: datetime


class SessionManageResponse(BaseModel):
    id: int
    classroom_id: int
    classroom_name: str | None = None
    content_id: int
    content_file_path: str | None = None
    teacher_id: int | None = None
    teacher_name: str | None = None
    subject: str | None = None
    session_name: str | None = None
    start_time: datetime
    duration: int
    expires_at: datetime
    status: str