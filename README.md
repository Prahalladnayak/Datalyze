# Datalyze — Intelligent Data Platform (Monorepo)

Datalyze is a production-ready, 3-tier monorepo SaaS platform designed to search, generate, clean, analyze, and build machine learning models on datasets.

```
Datalyze/
├── frontend/     # React 19 + Vite 7 + Tailwind CSS (PWA enabled)
├── backend/      # FastAPI API Gateway + PostgreSQL (Neon) + JWT + Razorpay
└── ml-service/   # Standalone ML Compute Service (scikit-learn, PyTorch, RunPod)
```

---

## 🏛️ Monorepo Architecture & Data Flow

```
┌─────────────────┐       HTTP / REST        ┌──────────────────┐
│                 │ ───────────────────────> │                  │
│    Frontend     │                          │     Backend      │
│  (Vercel / PWA) │ <─────────────────────── │  (API Gateway)   │
└─────────────────┘       JSON Response      └────────┬─────────┘
                                                      │
                                           Auth &     │ Forward ML
                                           Credits    │ Request
                                           OK         ▼
                                             ┌──────────────────┐
                                             │                  │
                                             │    ML Service    │
                                             │ (Render/RunPod)  │
                                             └──────────────────┘
```

1. **Frontend**: Communicates **only** with Backend API Gateway via HTTP.
2. **Backend**: Handles Authentication, JWT, Google Login, OTP, Credits, Razorpay Payments, PostgreSQL DB, Dataset Metadata, Admin Panel, Dataset Cleaning, Dataset Understanding (Gemini API), Kaggle Integration, and Search.
3. **ML Service**: Standalone microservice executing Supervised Learning (Classification, Regression), Clustering, Deep Learning, and NLP AutoML training. Can run locally/Render using scikit-learn or be seamlessly routed to serverless GPUs (RunPod) without modifying backend business logic.

---

## 📱 Progressive Web App (PWA) Features

Datalyze is fully equipped as a Progressive Web App:

- 💻 **Desktop Installable**: Install from Google Chrome or Microsoft Edge address bar
- 📱 **Mobile Installable**: Install on Android Chrome with native app manifest
- 🎨 **App Icons & Maskable Icons**: Custom branded icons (192x192, 512x512)
- 🔔 **Custom Install Banner**: Non-intrusive glassmorphism banner (`PWAInstallButton`) with 7-day dismiss memory
- ⚡ **Service Worker**: Auto-updating service worker powered by `vite-plugin-pwa` and Workbox

---

## 🚀 Quick Start Guide

### 1. ML Service (Port 8001)

```bash
cd ml-service
python -m venv .venv
.venv\Scripts\activate          # Windows
# source .venv/bin/activate     # macOS/Linux

pip install -r requirements.txt
cp .env.example .env

uvicorn app:app --host 0.0.0.0 --port 8001 --reload
```
*Health endpoint: http://localhost:8001/health*

### 2. Backend API Gateway (Port 8000)

```bash
cd backend
.venv\Scripts\activate          # Windows
# source .venv/bin/activate     # macOS/Linux

pip install -r requirements.txt
cp .env.example .env
# Ensure DATABASE_URL, JWT_SECRET_KEY, and ML_SERVICE_URL are set

uvicorn app:app --host 0.0.0.0 --port 8000 --reload
```
*API Documentation: http://localhost:8000/docs*
*Admin Panel: http://localhost:8000/admin/login*

### 3. Frontend Application (Port 5173)

```bash
cd frontend
npm install
cp .env.example .env

npm run dev
```
*App URL: http://localhost:5173*

---

## ⚙️ Environment Variables Summary

| Service | Key Variables |
|---------|---------------|
| **Frontend** | `VITE_API_URL`, `VITE_GOOGLE_CLIENT_ID` |
| **Backend** | `DATABASE_URL`, `JWT_SECRET_KEY`, `ML_SERVICE_URL`, `RAZORPAY_KEY_ID`, `RAZORPAY_KEY_SECRET`, `GEMINI_API_KEY`, `EMAIL_*` |
| **ML Service** | `GPU_PROVIDER`, `GPU_API_KEY`, `GPU_ENDPOINT`, `GPU_WEBHOOK_SECRET`, `GPU_MAX_RUNTIME`, `BACKEND_URL` |

---

## 🚢 Production Deployment

- **Frontend**: Deploy on **Vercel** (`Root Directory: frontend`)
- **Backend**: Deploy on **Render** (`Root Directory: backend`)
- **ML Service**: Deploy on **Render** initial stage (`Root Directory: ml-service`), easily migrate to **RunPod** GPU instances later.

---

## 🧪 Verification & Testing

- ✅ Backend startup validation & health checks
- ✅ ML Service startup validation & health checks
- ✅ User authentication, OTP, Google OAuth & JWT preservation
- ✅ Razorpay payment verification & credit management
- ✅ AutoML & Model Builder HTTP delegation (Backend → ML Service)
- ✅ PWA installation, manifest validation, and icon rendering
