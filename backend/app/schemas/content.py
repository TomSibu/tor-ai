from pydantic import BaseModel

class ContentResponse(BaseModel):
    id: int
    file_path: str

    class Config:
        from_attributes = True