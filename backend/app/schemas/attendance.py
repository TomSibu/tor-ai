from datetime import datetime
from typing import Optional

from pydantic import BaseModel


class AttendanceResponse(BaseModel):
    id: int
    session_id: int
    student_id: int
    status: str
    confidence: Optional[float] = None
    timestamp: datetime

    class Config:
        from_attributes = True


class AttendanceScanStudent(BaseModel):
    id: int
    name: str
    confidence: Optional[float] = None


class AttendanceScanReport(BaseModel):
    session_id: int
    classroom_id: int
    classroom_name: str
    total_students: int
    present_count: int
    absent_count: int
    present_students: list[AttendanceScanStudent]
    absent_students: list[AttendanceScanStudent]
    message: str
