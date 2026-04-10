from sqlalchemy import Column, Integer, String, ForeignKey, LargeBinary
from app.db.base import Base

class Student(Base):
    __tablename__ = "students"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String, nullable=False)
    roll_number = Column(String, nullable=True)
    email = Column(String, nullable=True)
    phone = Column(String, nullable=True)
    photo_path = Column(String, nullable=True)  # Path to student photo for facial recognition
    photo_filename = Column(String, nullable=True)
    photo_mime_type = Column(String, nullable=True)
    photo_data = Column(LargeBinary, nullable=True)
    classroom_id = Column(Integer, ForeignKey("classrooms.id"))