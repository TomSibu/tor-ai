from sqlalchemy import Column, Integer, ForeignKey, String
from app.db.base import Base

class TeacherClassroom(Base):
    __tablename__ = "teacher_classroom"

    id = Column(Integer, primary_key=True)
    teacher_id = Column(Integer, ForeignKey("users.id"))
    classroom_id = Column(Integer, ForeignKey("classrooms.id"))
    subject = Column(String)