from sqlalchemy import Column, Integer, String, Text, ForeignKey, LargeBinary
from app.db.base import Base

class Content(Base):
    __tablename__ = "contents"

    id = Column(Integer, primary_key=True, index=True)
    teacher_id = Column(Integer, ForeignKey("users.id"))
    classroom_id = Column(Integer, ForeignKey("classrooms.id"), nullable=True)
    file_path = Column(String)
    file_name = Column(String, nullable=True)
    file_mime_type = Column(String, nullable=True)
    file_data = Column(LargeBinary, nullable=True)
    extracted_text = Column(Text)