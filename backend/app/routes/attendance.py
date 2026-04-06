from fastapi import APIRouter, Depends, HTTPException
from requests import Session

from app.models.attendance import Attendance
from app.models.session import SeAttendance
from app.models.attendance import Attendancession
from app.db.session import get_db

router = APIRouter()

@router.post("/mark/{session_id}")
def mark_attendance(session_id: int, db: Session = Depends(get_db)):
    attendance = Attendance(session_id=session_id)
    db.add(attendance)
    db.commit()
    return {"message": "Attendance marked"}