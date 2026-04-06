from fastapi import FastAPI
from app.db.database import engine
from app.db.base import Base
from app.routes.user import router as user_router
from app.models import user
from fastapi.middleware.cors import CORSMiddleware
from app.models import User, Classroom, Student, Content, Session, SessionState, TeacherClassroom

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

@app.get("/")
def read_root():
    return {"message": "AI Tutor Backend Running 🚀"}