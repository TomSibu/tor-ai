from sqlalchemy import Column, Integer, ForeignKey, DateTime
from app.db.base import Base

class Session(Base):
    __tablename__ = "sessions"

    id = Column(Integer, primary_key=True, index=True)
    classroom_id = Column(Integer, ForeignKey("classrooms.id"))
    content_id = Column(Integer, ForeignKey("contents.id"))
    start_time = Column(DateTime)
    duration = Column(Integer)  # in minutes
    expires_at = Column(DateTime)