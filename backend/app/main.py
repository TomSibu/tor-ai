from fastapi import FastAPI
from app.db.database import engine
from app.db.base import Base
from app.routes.user import router as user_router
from app.models import user
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy import text
from datetime import timedelta
from app.models import User, Classroom, Student, Content, Session, SessionState, Attendance, TeacherClassroom, GeneratedAudio

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
        if "photo_filename" not in existing:
            conn.execute(text("ALTER TABLE students ADD COLUMN photo_filename VARCHAR"))
        if "photo_mime_type" not in existing:
            conn.execute(text("ALTER TABLE students ADD COLUMN photo_mime_type VARCHAR"))
        if "photo_data" not in existing:
            conn.execute(text("ALTER TABLE students ADD COLUMN photo_data BLOB"))


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
        if "file_name" not in existing:
            conn.execute(text("ALTER TABLE contents ADD COLUMN file_name VARCHAR"))
        if "file_mime_type" not in existing:
            conn.execute(text("ALTER TABLE contents ADD COLUMN file_mime_type VARCHAR"))
        if "file_data" not in existing:
            conn.execute(text("ALTER TABLE contents ADD COLUMN file_data BLOB"))


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

        if "teaching_content" not in existing:
            conn.execute(text("ALTER TABLE sessions ADD COLUMN teaching_content TEXT"))

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


def _ensure_generated_audio_table() -> None:
    with engine.begin() as conn:
        conn.execute(
            text(
                """
                CREATE TABLE IF NOT EXISTS generated_audio (
                    id INTEGER PRIMARY KEY,
                    audio_key VARCHAR NOT NULL UNIQUE,
                    mime_type VARCHAR NOT NULL DEFAULT 'audio/wav',
                    data BLOB NOT NULL,
                    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
                )
                """
            )
        )
        conn.execute(text("CREATE INDEX IF NOT EXISTS ix_generated_audio_audio_key ON generated_audio (audio_key)"))


_ensure_generated_audio_table()


def _ensure_user_columns() -> None:
    """Backfill user columns for existing SQLite databases."""
    with engine.begin() as conn:
        cols = conn.execute(text("PRAGMA table_info(users)")).fetchall()
        if not cols:
            return

        existing = {row[1] for row in cols}
        if "profile_pic" not in existing:
            conn.execute(text("ALTER TABLE users ADD COLUMN profile_pic VARCHAR"))


_ensure_user_columns()

@app.get("/")
def read_root():
    return {"message": "AI Tutor Backend Running 🚀"}