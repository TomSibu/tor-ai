from pydantic import BaseModel

class ClassroomCreate(BaseModel):
    name: str


class ClassroomResponse(BaseModel):
    id: int
    name: str
    teacher_names: list[str]

    class Config:
        from_attributes = True