from fastapi import FastAPI
from app.db.database import engine
from app.db.base import Base
from app.routes.user import router as user_router
from app.models import user
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy import text
from datetime import timedelta
from app.models import User, Classroom, Student, Content, Session, SessionState, Attendance, TeacherClassroom

app = FastAPI()
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(user_router, prefix="/users", tags=["Users"])

from app.routes import classroom

app.include_router(classroom.router, prefix="/classrooms", tags=["Classrooms"])

from app.routes import student

app.include_router(student.router, prefix="/students", tags=["Students"])

from app.routes import attendance

app.include_router(attendance.router, prefix="/attendance", tags=["Attendance"])

from app.routes import content, session

app.include_router(content.router, prefix="/content", tags=["Content"])
app.include_router(session.router, prefix="/sessions", tags=["Sessions"])

from app.routes import ai

app.include_router(ai.router, prefix="/ai", tags=["AI"])

from fastapi.staticfiles import StaticFiles

app.mount("/audio", StaticFiles(directory="audio"), name="audio")

from app.routes import voice

app.include_router(voice.router, prefix="/voice", tags=["Voice"])

Base.metadata.create_all(bind=engine)


def _ensure_student_columns() -> None:
    """Backfill newly added student columns for existing SQLite databases."""
    with engine.begin() as conn:
        cols = conn.execute(text("PRAGMA table_info(students)")).fetchall()
        existing = {row[1] for row in cols}

        if "roll_number" not in existing:
            conn.execute(text("ALTER TABLE students ADD COLUMN roll_number VARCHAR"))
        if "email" not in existing:
            conn.execute(text("ALTER TABLE students ADD COLUMN email VARCHAR"))
        if "phone" not in existing:
            conn.execute(text("ALTER TABLE students ADD COLUMN phone VARCHAR"))
        if "photo_path" not in existing:
            conn.execute(text("ALTER TABLE students ADD COLUMN photo_path VARCHAR"))


_ensure_student_columns()


def _ensure_attendance_columns() -> None:
    """Backfill attendance columns for existing SQLite databases."""
    with engine.begin() as conn:
        cols = conn.execute(text("PRAGMA table_info(attendance)")).fetchall()
        if not cols:
            return

        existing = {row[1] for row in cols}

        if "student_id" not in existing:
            conn.execute(text("ALTER TABLE attendance ADD COLUMN student_id INTEGER"))
        if "status" not in existing:
            conn.execute(text("ALTER TABLE attendance ADD COLUMN status VARCHAR"))
        if "confidence" not in existing:
            conn.execute(text("ALTER TABLE attendance ADD COLUMN confidence FLOAT"))


_ensure_attendance_columns()


def _ensure_content_columns() -> None:
    """Backfill content columns for existing SQLite databases."""
    with engine.begin() as conn:
        cols = conn.execute(text("PRAGMA table_info(contents)")).fetchall()
        if not cols:
            return

        existing = {row[1] for row in cols}
        if "classroom_id" not in existing:
            conn.execute(text("ALTER TABLE contents ADD COLUMN classroom_id INTEGER"))


_ensure_content_columns()


def _ensure_session_columns() -> None:
    """Backfill session columns for existing SQLite databases."""
    with engine.begin() as conn:
        cols = conn.execute(text("PRAGMA table_info(sessions)")).fetchall()
        if not cols:
            return

        existing = {row[1] for row in cols}
        if "expires_at" not in existing:
            conn.execute(text("ALTER TABLE sessions ADD COLUMN expires_at DATETIME"))

        rows = conn.execute(text("SELECT id, start_time, duration, expires_at FROM sessions")).fetchall()
        for row in rows:
            session_id = row[0]
            start_time = row[1]
            duration = row[2]
            expires_at = row[3]

            if start_time and duration is not None and expires_at is None:
                conn.execute(
                    text("UPDATE sessions SET expires_at = datetime(start_time, :offset) WHERE id = :session_id"),
                    {
                        "offset": f"+{int(duration)} minutes",
                        "session_id": session_id,
                    },
                )


_ensure_session_columns()

@app.get("/")
def read_root():
    return {"message": "AI Tutor Backend Running 🚀"}