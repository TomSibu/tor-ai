from sqlalchemy import Column, Integer, String, ForeignKey
from app.db.base import Base

class Student(Base):
    __tablename__ = "students"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String, nullable=False)
    classroom_id = Column(Integer, ForeignKey("classrooms.id"))