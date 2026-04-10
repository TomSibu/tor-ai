<p align="center">
![GitHub Repo Views](https://gitviews.com/repo/TomSibu/tor-ai.svg)
</p>

<p align="center">
<a href="https://github.com/TomSibu/tor-ai/stargazers"><img src="https://img.shields.io/github/stars/TomSibu/tor-ai?style=for-the-badge&logo=github" alt="GitHub Stars" /></a>
<a href="https://github.com/TomSibu/tor-ai/network/members"><img src="https://img.shields.io/github/forks/TomSibu/tor-ai?style=for-the-badge&logo=github" alt="GitHub Forks" /></a>
<a href="https://github.com/TomSibu"><img src="https://img.shields.io/badge/GitHub-@TomSibu-181717?style=for-the-badge&logo=github" alt="TomSibu GitHub Profile" /></a>
</p>

# AI Tutor Platform

AI Tutor is a full-stack learning platform with role-based access, session-based teaching, PDF content ingestion, and AI-assisted Q&A.

It includes:
- FastAPI backend with SQLite
- React + Vite + TypeScript frontend
- JWT authentication and role-based authorization
- AI teaching flow using Gemini with Mistral fallback
- Voice question flow (speech-to-text + text-to-speech)

## Repository Layout

```text
TOR AI/
|- backend/
|  |- app/
|  |  |- main.py
|  |  |- routes/
|  |  |- models/
|  |  |- schemas/
|  |  |- services/
|  |  |- db/
|  |  |- utils/
|  |- requirements.txt
|  |- uploads/
|  |- audio/
|  |- voice_uploads/
|- frontend/
|  |- src/
|  |- public/
|  |- package.json
|- README.md
```

## Current Tech Stack

Backend:
- FastAPI
- SQLAlchemy + SQLite (ai_tutor.db)
- JWT auth
- pdfplumber (PDF extraction)
- Piper TTS (audio output)
- OpenAI Whisper API (speech-to-text)
- Gemini API with Mistral fallback

Frontend:
- React 18
- Vite 5
- TypeScript
- Tailwind CSS
- Radix UI components
- React Router
- Axios

## Prerequisites

- Python 3.10+
- Node.js 18+
- npm 9+

## Environment Variables

Create a backend .env file at backend/.env:

```env
GEMINI_API_KEY=your_gemini_key
MISTRAL_API_KEY=your_mistral_key
OPENAI_API_KEY=your_openai_key
PIPER_BIN=piper
PIPER_MODEL_PATH=E:/models/piper/en_US-lessac-medium.onnx
PIPER_CONFIG_PATH=E:/models/piper/en_US-lessac-medium.onnx.json
# Optional (multi-speaker models only)
PIPER_SPEAKER_ID=0
```

Notes:
- Gemini is used first for teaching/Q&A.
- Mistral is used as fallback if Gemini fails.
- OpenAI key is used for speech transcription.
- Piper is used for text-to-speech synthesis. Install Piper binary and download a model.

Piper quick check:

```bash
piper --help
echo "hello class" | piper --model E:/models/piper/en_US-lessac-medium.onnx --output_file test.wav
```

## Local Development

### 1) Start Backend

From repository root:

```bash
cd backend
python -m venv .venv
# Windows PowerShell
.\.venv\Scripts\Activate.ps1
pip install -r requirements.txt
uvicorn app.main:app --reload --host 127.0.0.1 --port 8000
```

Backend URLs:
- API root: http://127.0.0.1:8000/
- Interactive docs: http://127.0.0.1:8000/docs

### 2) Start Frontend

Open a new terminal from repository root:

```bash
cd frontend
npm install
npm run dev
```

Frontend URL (default Vite):
- http://127.0.0.1:5173/

## API Overview

Base URL: http://127.0.0.1:8000

Auth and users:
- POST /users/register
- POST /users/login
- GET /users/me
- GET /users/pending-users
- PUT /users/verify/{user_id}
- DELETE /users/{user_id}
- GET /users/my-classes

Classrooms:
- POST /classrooms/
- POST /classrooms/assign-teacher
- GET /classrooms/
- GET /classrooms/my-dashboard

Students:
- POST /students/
- GET /students/classroom/{classroom_id}

Content:
- POST /content/upload

Sessions:
- POST /sessions/

AI session flow:
- GET /ai/teach/{session_id}
- POST /ai/ask
- POST /ai/start/{session_id}
- POST /ai/ask/{session_id}
- POST /ai/continue/{session_id}

Voice:
- POST /voice/ask-voice

## Frontend Scripts

From frontend:

```bash
npm run dev       # Start Vite dev server
npm run build     # Production build
npm run preview   # Preview built app
npm run lint      # Lint
npm run test      # Run tests once
npm run test:watch
```

## Authentication and Roles

Roles used in the system:
- admin
- teacher
- classroom

General flow:
1. User logs in and receives JWT.
2. Frontend stores token in localStorage.
3. Axios interceptor attaches Bearer token.
4. Backend enforces access with role checks.

## Data and File Storage

Backend runtime data:
- SQLite DB file: backend/ai_tutor.db
- Uploaded PDFs: backend/uploads/
- Generated audio: backend/audio/
- Voice uploads: backend/voice_uploads/

## GitHub Setup (First Push)

From repository root:

```bash
git init
git add .
git commit -m "Initial commit"
git branch -M main
git remote add origin https://github.com/<your-username>/<your-repo>.git
git push -u origin main
```

If Windows shows a dubious ownership error:

```bash
git config --global --add safe.directory "E:/Tom Sibu/TOR AI"
```

## Recommended Next Improvements

- Keep backend/requirements.txt fully updated and pinned
- Move JWT secret into environment variables
- Hash passwords before storing
- Restrict CORS origins for non-local environments
- Add backend tests and CI

## License

Add your preferred license before public release.
