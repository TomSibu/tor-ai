from sqlalchemy import Column, Integer, ForeignKey, DateTime, String, Float, UniqueConstraint
from app.db.base import Base
from datetime import datetime

class Attendance(Base):
    __tablename__ = "attendance"

    __table_args__ = (
        UniqueConstraint("session_id", "student_id", name="uq_attendance_session_student"),
    )

    id = Column(Integer, primary_key=True)
    session_id = Column(Integer, ForeignKey("sessions.id"), nullable=False, index=True)
    student_id = Column(Integer, ForeignKey("students.id"), nullable=False, index=True)
    status = Column(String, nullable=False)
    confidence = Column(Float, nullable=True)
    timestamp = Column(DateTime, default=datetime.utcnow)