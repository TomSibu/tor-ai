from sqlalchemy import Column, Integer, ForeignKey, Text
from app.db.base import Base

class SessionState(Base):
    __tablename__ = "session_states"

    id = Column(Integer, primary_key=True)
    session_id = Column(Integer, ForeignKey("sessions.id"))
    current_index = Column(Integer, default=0)
    status = Column(Text, default="running")  # running, paused