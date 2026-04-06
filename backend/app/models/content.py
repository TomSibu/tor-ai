from sqlalchemy import Column, Integer, String, Text, ForeignKey
from app.db.base import Base

class Content(Base):
    __tablename__ = "contents"

    id = Column(Integer, primary_key=True, index=True)
    teacher_id = Column(Integer, ForeignKey("users.id"))
    classroom_id = Column(Integer, ForeignKey("classrooms.id"), nullable=True)
    file_path = Column(String)
    extracted_text = Column(Text)