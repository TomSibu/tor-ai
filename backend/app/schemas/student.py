from pydantic import BaseModel

class StudentCreate(BaseModel):
    name: str
    classroom_id: int


class StudentResponse(BaseModel):
    id: int
    name: str
    classroom_id: int

    class Config:
        from_attributes = True