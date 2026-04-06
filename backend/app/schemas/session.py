from pydantic import BaseModel
from datetime import datetime

class SessionCreate(BaseModel):
    classroom_id: int
    content_id: int
    start_time: datetime
    duration: int


class SessionResponse(BaseModel):
    id: int
    classroom_id: int
    content_id: int
    start_time: datetime
    duration: int

    class Config:
        from_attributes = True