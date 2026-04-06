from pydantic import BaseModel

class ClassroomCreate(BaseModel):
    name: str


class ClassroomResponse(BaseModel):
    id: int
    name: str
    teacher_id: int | None

    class Config:
        from_attributes = True