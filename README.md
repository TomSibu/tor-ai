# 🎓 AI Tutor - Intelligent Learning Platform

A modern, full-stack AI-powered tutoring system with role-based access control, interactive live sessions, and intelligent content delivery.

## 🌟 Features

### Core Features
- ✅ **Role-Based Access Control** - Admin, Teacher, and Student/Classroom roles
- ✅ **User Management** - Registration, verification, and user administration
- ✅ **Content Management** - PDF upload and extraction
- ✅ **Session Management** - Create and manage live teaching sessions
- ✅ **Interactive Learning** - Real-time Q&A with AI tutor
- ✅ **Modern UI** - Clean, responsive design inspired by professional dashboards
- ✅ **Real-time Updates** - Live session interactions with instant feedback

### Admin Features
- 👑 Manage user registrations and verifications
- 👑 Create and manage classrooms
- 👑 Assign teachers to classrooms
- 👑 Monitor platform activity
- 👑 User deletion and role management

### Teacher Features
- 📚 Upload teaching materials (PDF)
- 📚 Create and schedule teaching sessions
- 📚 Manage assigned classrooms
- 📚 Track session statistics
- 📚 View student engagement

### Student/Classroom Features
- 🎓 View available sessions
- 🎓 Join live teaching sessions
- 🎓 Interactive Q&A with AI tutor
- 🎓 Access course materials
- 🎓 Track learning progress

---

## 🚀 Quick Start

### Prerequisites
- Python 3.10+
- Node.js 16+
- npm or yarn

### Installation

1. **Clone and navigate to project**
```bash
cd "TOR AI"
```

2. **Start Backend**
```bash
cd backend
pip install -r requirements.txt
uvicorn app.main:app --reload
```
Backend runs on: `http://localhost:8000`

3. **Start Frontend** (in new terminal)
```bash
cd frontend
npm install
npm start
```
Frontend runs on: `http://localhost:3000`

4. **Test Login**
```
Email: admin@test.com
Password: password
```

See [QUICK_START.md](./QUICK_START.md) for detailed guide.

---

## 📁 Project Structure

```
TOR AI/
├── backend/                  # FastAPI backend
│   ├── app/
│   │   ├── main.py          # API entry point
│   │   ├── models/          # Database models
│   │   │   ├── user.py
│   │   │   ├── classroom.py
│   │   │   ├── content.py
│   │   │   ├── session.py
│   │   │   ├── student.py
│   │   │   └── ...
│   │   ├── routes/          # API endpoints
│   │   │   ├── user.py
│   │   │   ├── admin.py
│   │   │   ├── classroom.py
│   │   │   ├── session.py
│   │   │   ├── content.py
│   │   │   └── ...
│   │   ├── schemas/         # Request/response models
│   │   ├── services/        # Business logic
│   │   │   ├── ai_service.py
│   │   │   ├── pdf_service.py
│   │   │   └── ...
│   │   ├── db/              # Database configuration
│   │   └── utils/           # Utilities (JWT, Security)
│   ├── requirements.txt
│   ├── uploads/             # Uploaded PDFs
│   └── audio/               # Audio files
│
└── frontend/                # React frontend
    ├── public/
    ├── src/
    │   ├── pages/
    │   │   ├── Login.js              # Authentication
    │   │   ├── AdminDashboard.js     # Admin panel
    │   │   ├── TeacherDashboard.js   # Teacher panel
    │   │   ├── ClassroomDashboard.js # Student panel
    │   │   └── LiveSession.js        # Live teaching UI
    │   ├── components/
    │   │   └── Sidebar.js            # Navigation
    │   ├── contexts/
    │   │   └── AuthContext.js        # Auth state
    │   ├── services/
    │   │   └── api.service.js        # API calls
    │   ├── api/
    │   │   └── api.js               # Axios config
    │   ├── App.js                   # Routing
    │   └── index.css                # Tailwind CSS
    ├── package.json
    ├── tailwind.config.js
    └── FRONTEND_BUILD_GUIDE.md
```

---

## 🔐 Authentication Flow

```
User Registration/Login
        ↓
JWT Token Generated
        ↓
Token + User Data → LocalStorage
        ↓
Protected Routes Verify Access
        ↓
Role-Based Dashboard Loaded
        ↓
(Admin/Teacher/Student Views)
```

---

## APIs Overview

### User & Auth APIs
- `POST /users/register` - Register new user
- `POST /users/login` - Login and get JWT token
- `GET /users/me` - Get current user
- `PUT /users/verify/{user_id}` - Verify user (admin only)
- `DELETE /users/{user_id}` - Delete user (admin only)

### Classroom APIs
- `POST /classrooms/` - Create classroom (admin only)
- `GET /classrooms/` - List classrooms (admin only)
- `POST /classrooms/assign-teacher` - Assign teacher (admin only)
- `GET /classrooms/my-dashboard` - Get student's classroom

### Content APIs
- `POST /content/upload` - Upload PDF content (teacher)
- `GET /content/my-content` - Get teacher's content

### Session APIs
- `POST /sessions/` - Create session (teacher)
- `GET /sessions/classroom/{id}` - Get classroom sessions
- `GET /sessions/{id}` - Get session details
- `POST /ai/chat` - Chat with AI tutor

---

## 🎨 Design System

### Color Palette
| Color | Usage | Hex |
|-------|-------|-----|
| Blue | Primary Actions | #3b82f6 |
| Green | Success States | #10b981 |
| Red | Danger Actions | #ef4444 |
| Orange | Warnings | #f97316 |
| Gray | Backgrounds | #f9fafb |
| Dark Gray | Text | #111827 |

### Typography
- **Heading:** Font size 24-32px, Bold
- **Body:** Font size 14-16px, Regular
- **Small text:** Font size 12px, Gray-500

---

## 🔧 Tech Stack

### Backend
- **Framework:** FastAPI (Python)
- **Database:** SQLite with SQLAlchemy ORM
- **Authentication:** JWT (JSON Web Tokens)
- **PDF Processing:** PyPDF
- **AI Integration:** OpenAI/Custom LLM
- **CORS:** Enabled for frontend access

### Frontend
- **UI Framework:** React 19
- **Styling:** Tailwind CSS
- **Routing:** React Router v7
- **HTTP Client:** Axios
- **State Management:** React Context API
- **Build Tool:** Create React App

---

## 📊 User Roles

### Admin
- Create and manage classrooms
- Verify/reject teacher registrations
- Manage platform users
- Assign teachers to classrooms
- View platform analytics

### Teacher
- Upload teaching materials
- Create sessions
- Manage classrooms
- Track student engagement
- View session analytics

### Student/Classroom
- Join sessions
- Ask questions during sessions
- Access learning materials
- Track personal progress
- View session history

---

## 🚀 Deployment

### Backend Deployment
1. Install dependencies: `pip install -r requirements.txt`
2. Set environment variables (database URL, AI API keys, etc.)
3. Run with gunicorn: `gunicorn app.main:app -w 4`
4. Deploy to cloud platform (Heroku, AWS, Google Cloud, etc.)

### Frontend Deployment
1. Build: `npm run build`
2. Serve build directory (using serve or web server)
3. Update API URL in `src/api/api.js`
4. Deploy to cloud (Vercel, Netlify, AWS S3+CloudFront, etc.)

---

## 🐛 Troubleshooting

### Backend Issues
- **Port 8000 already in use:** Change port with `--port 8001`
- **Database errors:** Delete `app.db` and restart server
- **CORS errors:** Check CORS settings in `app/main.py`

### Frontend Issues
- **Can't connect to backend:** Verify backend URL in `api/api.js`
- **Tailwind CSS not working:** Run `npm install -D tailwindcss`
- **Login fails:** Ensure user is registered and verified by admin
- **Routes not working:** Check browser console for errors

---

## 📚 Documentation

- **[QUICK_START.md](./QUICK_START.md)** - 5-minute setup guide
- **[FRONTEND_BUILD_GUIDE.md](./frontend/FRONTEND_BUILD_GUIDE.md)** - Detailed frontend guide
- **[backend/README.md](./backend/README.md)** - Backend documentation

---

## 🤝 Contributing

1. Create feature branch: `git checkout -b feature/amazing-feature`
2. Commit changes: `git commit -m 'Add amazing feature'`
3. Push to branch: `git push origin feature/amazing-feature`
4. Open Pull Request

---

## 📝 License

© 2024 AI Tutor. All rights reserved.

---

## 🎯 Future Roadmap

### Phase 2
- [ ] Video session support
- [ ] Speech-to-text for questions
- [ ] Student progress tracking
- [ ] Certificate generation
- [ ] Advanced analytics
- [ ] Attendance tracking

### Phase 3
- [ ] Mobile app
- [ ] Real-time notifications
- [ ] Collaborative whiteboards
- [ ] Assignment system
- [ ] Grade management
- [ ] Parent portal

---

## 💡 Support

For issues, questions, or suggestions:
1. Check [QUICK_START.md](./QUICK_START.md)
2. Review documentation in respective folders
3. Check error messages in console
4. Verify backend/frontend are running

---

## 🎉 Getting Started

Ready to get started? Follow these steps:

1. **Read** [QUICK_START.md](./QUICK_START.md)
2. **Start** backend and frontend servers
3. **Test** with demo admin account
4. **Explore** all user roles
5. **Customize** as needed

Happy Learning! 🚀

---

**Last Updated:** 2024
**Version:** 1.0.0
