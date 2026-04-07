from pydantic import BaseModel

class ContentResponse(BaseModel):
    id: int
    teacher_id: int
    classroom_id: int | None = None
    classroom_name: str | None = None
    file_path: str

    class Config:
        from_attributes = True