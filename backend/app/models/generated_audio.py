from sqlalchemy import Column, Integer, String, LargeBinary, DateTime
from sqlalchemy.sql import func

from app.db.base import Base


class GeneratedAudio(Base):
    __tablename__ = "generated_audio"

    id = Column(Integer, primary_key=True, index=True)
    audio_key = Column(String, unique=True, index=True, nullable=False)
    mime_type = Column(String, nullable=False, default="audio/wav")
    data = Column(LargeBinary, nullable=False)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
