# Datalyze Frontend (PWA)

Single Page Application & Progressive Web App for the Datalyze platform.

## Tech Stack

- **Framework**: React 19 + Vite 7
- **Styling**: Tailwind CSS 3
- **Icons**: Lucide React
- **PWA**: vite-plugin-pwa + Workbox
- **State/Auth**: React Context API (`AuthContext.jsx`)

## PWA Features

- 📱 **Installable**: Desktop (Chrome/Edge) & Mobile (Android Chrome)
- ⚡ **Offline Support**: Offline fallback shell via Service Worker
- 🎨 **App Manifest**: Theme color `#a855f7`, dark theme `#0f0f1a`, custom maskable icons
- 🔘 **Smart Install Banner**: Custom glassmorphism `PWAInstallButton` component with 7-day dismiss memory

## Communication Architecture

```
Frontend (Vercel)
     ↓  (HTTP REST API via Vite proxy / VITE_API_URL)
Backend (Render)
     ↓  (HTTP REST API via ML_SERVICE_URL)
ML Service (Render / RunPod)
```

The Frontend communicates **ONLY** with the Backend service. It **never** makes direct requests to the ML Service.

## Local Development

```bash
# 1. Install dependencies
npm install

# 2. Configure environment
cp .env.example .env

# 3. Start dev server
npm run dev
```

App will run at: http://localhost:5173

Vite dev proxy forwards `/api/*` and `/admin/*` to `http://127.0.0.1:8000` (Backend).

## Production Build

```bash
npm run build
```

Output directory: `dist/`

## Deployment (Vercel)

1. Connect GitHub repository to Vercel
2. Set **Root Directory** to `frontend`
3. Framework Preset: **Vite**
4. Environment Variables:
   - `VITE_GOOGLE_CLIENT_ID`
   - `VITE_API_URL` (URL of your deployed Backend)
