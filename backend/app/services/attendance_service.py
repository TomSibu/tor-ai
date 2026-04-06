from __future__ import annotations

import os
import time
from dataclasses import dataclass
from typing import Optional

import cv2
import face_recognition
import numpy as np
from fastapi import HTTPException
from sqlalchemy.orm import Session

from app.models.attendance import Attendance
from app.models.classroom import Classroom
from app.models.session import Session as SessionModel
from app.models.student import Student


@dataclass
class KnownFace:
    student: Student
    encoding: np.ndarray


def face_confidence(face_distance: float, face_match_threshold: float = 0.6) -> float:
    range_val = 1.0 - face_match_threshold
    linear_val = (1.0 - face_distance) / (range_val * 2.0)

    if face_distance > face_match_threshold:
        return round(max(linear_val, 0.0) * 100.0, 2)

    value = linear_val + ((1.0 - linear_val) * pow((linear_val - 0.5) * 2.0, 0.2))
    return round(max(value, 0.0) * 100.0, 2)


def _load_known_faces(students: list[Student]) -> list[KnownFace]:
    known_faces: list[KnownFace] = []

    for student in students:
        if not student.photo_path or not os.path.exists(student.photo_path):
            continue

        image = face_recognition.load_image_file(student.photo_path)
        encodings = face_recognition.face_encodings(image)
        if not encodings:
            continue

        known_faces.append(KnownFace(student=student, encoding=encodings[0]))

    return known_faces


def _upsert_attendance(db: Session, session_id: int, student: Student, status: str, confidence: Optional[float]) -> Attendance:
    attendance = db.query(Attendance).filter(
        Attendance.session_id == session_id,
        Attendance.student_id == student.id,
    ).first()

    if attendance is None:
        attendance = Attendance(
            session_id=session_id,
            student_id=student.id,
            status=status,
            confidence=confidence,
        )
        db.add(attendance)
    else:
        attendance.status = status
        attendance.confidence = confidence

    return attendance


def capture_session_attendance(db: Session, session_id: int, timeout_seconds: int = 12, camera_index: int = 0) -> dict:
    session_obj = db.query(SessionModel).filter(SessionModel.id == session_id).first()
    if not session_obj:
        raise HTTPException(status_code=404, detail="Session not found")

    classroom = db.query(Classroom).filter(Classroom.id == session_obj.classroom_id).first()
    if not classroom:
        raise HTTPException(status_code=404, detail="Classroom not found")

    students = db.query(Student).filter(Student.classroom_id == classroom.id).order_by(Student.name.asc()).all()
    known_faces = _load_known_faces(students)

    camera = cv2.VideoCapture(camera_index)
    if not camera.isOpened():
        raise HTTPException(status_code=503, detail="Camera is not available on this machine")

    present_confidence: dict[int, float] = {}
    process_current_frame = True
    started_at = time.time()

    try:
        while time.time() - started_at < timeout_seconds:
            success, frame = camera.read()
            if not success:
                time.sleep(0.1)
                continue

            if process_current_frame and known_faces:
                small_frame = cv2.resize(frame, (0, 0), fx=0.25, fy=0.25)
                rgb_small_frame = cv2.cvtColor(small_frame, cv2.COLOR_BGR2RGB)

                face_locations = face_recognition.face_locations(rgb_small_frame)
                face_encodings = face_recognition.face_encodings(rgb_small_frame, face_locations)

                for face_encoding in face_encodings:
                    known_encodings = [entry.encoding for entry in known_faces]
                    face_matches = face_recognition.compare_faces(known_encodings, face_encoding)
                    face_distances = face_recognition.face_distance(known_encodings, face_encoding)

                    if len(face_distances) == 0:
                        continue

                    best_match_index = int(np.argmin(face_distances))
                    if face_matches[best_match_index]:
                        matched_student = known_faces[best_match_index].student
                        confidence = face_confidence(float(face_distances[best_match_index]))
                        present_confidence[matched_student.id] = max(present_confidence.get(matched_student.id, 0.0), confidence)

            process_current_frame = not process_current_frame

        present_students = []
        absent_students = []

        for student in students:
            confidence = present_confidence.get(student.id)
            status = "present" if confidence is not None else "absent"
            _upsert_attendance(db, session_id, student, status, confidence)

            student_payload = {
                "id": student.id,
                "name": student.name,
                "confidence": confidence,
            }

            if status == "present":
                present_students.append(student_payload)
            else:
                absent_students.append(student_payload)

        db.commit()

        return {
            "session_id": session_id,
            "classroom_id": classroom.id,
            "classroom_name": classroom.name,
            "total_students": len(students),
            "present_count": len(present_students),
            "absent_count": len(absent_students),
            "present_students": present_students,
            "absent_students": absent_students,
            "message": "Attendance captured successfully",
        }
    finally:
        camera.release()
        try:
            cv2.destroyAllWindows()
        except Exception:
            pass
