
<p align="center">
<img src="https://gitviews.com/repo/TomSibu/tor-ai.svg" alt="Repo Views" />
</p>


<p align="center">
<a href="https://github.com/TomSibu/tor-ai/stargazers"><img src="https://img.shields.io/github/stars/TomSibu/tor-ai?style=for-the-badge&logo=github" alt="GitHub Stars" /></a>
<a href="https://github.com/TomSibu/tor-ai/network/members"><img src="https://img.shields.io/github/forks/TomSibu/tor-ai?style=for-the-badge&logo=github" alt="GitHub Forks" /></a>
<a href="https://github.com/TomSibu"><img src="https://img.shields.io/badge/GitHub-@TomSibu-181717?style=for-the-badge&logo=github" alt="TomSibu GitHub Profile" /></a>
</p>

# AI Tutor Platform

TUTOR AI is a full-stack classroom tutoring platform built around role-based workflows for admins, teachers, and classroom users.

The system combines classroom management, content distribution, attendance tooling, and AI-assisted teaching into one application.

## Core Features

- Role-based authentication and authorization (`admin`, `teacher`, `classroom`)
- Admin-managed user verification flow
- Classroom and teacher assignment management
- Student roster management with photo uploads
- Study material uploads (PDF) with classroom-level access control
- Session scheduling and classroom session execution
- AI teaching flow with generated lecture-style content
- Voice pipeline support (speech-to-text + text-to-speech)
- Profile management (including profile picture)
- Forgot password flow that reverts user to pending verification
- Persistent light/dark theme toggle across all pages

## Tech Stack

Backend:
- FastAPI
- SQLAlchemy
- SQLite (default local database)
- JWT token auth
- Passlib password hashing
- Google GenAI + Mistral + OpenAI integrations
- pdfplumber, OpenCV, face-recognition, SpeechRecognition, Whisper, gTTS

Frontend:
- React 18
- Vite 5
- TypeScript
- Tailwind CSS + shadcn/ui (Radix primitives)
- TanStack Query
- React Router
- Axios

## Project Structure

```text
TOR AI/
|- backend/
|  |- app/
|  |  |- main.py              # FastAPI app entry and startup schema backfills
|  |  |- config.py            # environment config
|  |  |- db/                  # SQLAlchemy base/session
|  |  |- models/              # ORM models
|  |  |- routes/              # API route modules
|  |  |- schemas/             # Pydantic request/response models
|  |  |- services/            # AI, audio, PDF, attendance logic
|  |  |- utils/               # auth, dependencies, security helpers
|  |- requirements.txt
|  |- .env.example
|- frontend/
|  |- src/
|  |  |- components/
|  |  |- contexts/
|  |  |- lib/
|  |  |- pages/
|  |- public/
|  |- package.json
|  |- .env.example
|- .gitignore
|- README.md
|- LICENSE
```

## From-Scratch Setup

## 1. Prerequisites

- Python 3.10+
- Node.js 18+
- npm 9+

## 2. Clone Repository

```bash
git clone <your-repo-url>
cd "TOR AI"
```

## 3. Backend Setup

```bash
cd backend
python -m venv .venv
```

Activate environment:

Windows PowerShell:

```powershell
.\.venv\Scripts\Activate.ps1
```

Install backend dependencies:

```bash
pip install -r requirements.txt
```

Create local environment file from example:

```bash
copy .env.example .env
```

Populate values in `backend/.env`:

```env
GEMINI_API_KEY=your_gemini_api_key
MISTRAL_API_KEY=your_mistral_api_key
OPENAI_API_KEY=your_openai_api_key

# Piper text-to-speech
PIPER_BIN=piper
PIPER_MODEL_PATH=E:/models/piper/en_US-lessac-medium.onnx
PIPER_CONFIG_PATH=E:/models/piper/en_US-lessac-medium.onnx.json
PIPER_SPEAKER_ID=0
```

Run backend:

```bash
uvicorn app.main:app --reload --host 127.0.0.1 --port 8000
```

Backend URLs:
- API root: http://127.0.0.1:8000/
- OpenAPI docs: http://127.0.0.1:8000/docs

## 4. Frontend Setup

Open a second terminal from repository root:

```bash
cd frontend
npm install
```

Create local frontend env file from example:

```bash
copy .env.example .env
```

Default frontend env value:

```env
VITE_API_BASE_URL=http://127.0.0.1:8000
```

Run frontend:

```bash
npm run dev
```

Frontend URL:
- http://127.0.0.1:5173/

## Runtime Behavior and Auth Rules

- Admin users are auto-verified at registration.
- Teacher and classroom users require admin verification before login.
- Passwords are stored hashed.
- Forgot-password flow changes password and marks account unverified again.
- Profile-page password changes do not trigger re-verification.

## Data and Storage Notes

- Default local DB: `backend/ai_tutor.db`
- Media is DB-backed for core flows (student photos, content files, generated audio)
- Legacy folder paths may exist locally but are not required for normal DB-backed operations
- Startup includes SQLite schema backfill helpers for compatibility with older local DBs

## Useful Commands

Backend:

```bash
cd backend
uvicorn app.main:app --reload
```

Frontend:

```bash
cd frontend
npm run dev
npm run build
npm run lint
npm run test
```

## High-Level API Surface

Authentication and users:
- `POST /users/register`
- `POST /users/login`
- `POST /users/forgot-password`
- `GET /users/me`
- `PUT /users/me`
- `GET /users/pending-users`
- `PUT /users/verify/{user_id}`

Classrooms, students, and content:
- `POST /classrooms/...`
- `POST /students/...`
- `POST /content/upload`
- `GET /content/classroom/{classroom_id}`
- `GET /content/{content_id}/file`

Sessions and AI:
- `POST /sessions/...`
- `GET /ai/teach/{session_id}`
- `POST /ai/ask/{session_id}`

Voice:
- `POST /voice/ask-voice`

## Troubleshooting

- PowerShell blocks script execution for virtualenv activation:

```powershell
Set-ExecutionPolicy -ExecutionPolicy RemoteSigned -Scope CurrentUser
```

- Browser still shows old favicon/theme assets:
	- Hard refresh with `Ctrl + F5`

- Tailwind `@tailwind` or `@apply` warnings in editor:
	- These are editor CSS-lint false positives and are suppressed in workspace settings

- `face_recognition_models` `pkg_resources` deprecation warning:
	- This project pins `setuptools==80.9.0` to avoid the warning in current dependency versions

## Security Notes

Before production deployment:
- Move JWT secret to environment variable (currently hardcoded in util module)
- Restrict CORS origins to trusted domains
- Use a production-grade DB (PostgreSQL/MySQL) instead of SQLite
- Add rate limiting and audit logging
- Rotate and protect API keys

## License

This project is licensed under the MIT License. See [LICENSE](LICENSE).
