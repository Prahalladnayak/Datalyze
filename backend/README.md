# Datalyze Backend (API Gateway)

Production API Gateway for the Datalyze SaaS platform built with FastAPI and PostgreSQL (asyncpg).

## Responsibilities

- **Authentication**: JWT, bcrypt, Google OAuth, OTP verification, Password Reset
- **User & Credits**: Subscriptions, credit deduction, usage activity logs
- **Payments**: Razorpay order creation and HMAC-SHA256 signature verification
- **Data Operations**: Dataset upload, pandas cleaning, dataset understanding (Gemini API), web extraction, synthetic data generation, Kaggle search
- **Admin Panel**: Internal HTML dashboard with cookie auth (`/admin`)
- **ML Gateway**: Validates auth and credits, then forwards training/AutoML requests to `ML_SERVICE_URL`

## Architecture

```
Frontend → Backend (API Gateway) → ML Service
                  ↓
          PostgreSQL (Neon)
```

The Backend handles all business logic, authorization, payments, and credit metering. It delegates heavy machine learning computation to the standalone ML Service.

## Local Development

```bash
# 1. Activate virtual environment
.venv\Scripts\activate        # Windows
# source .venv/bin/activate   # macOS/Linux

# 2. Install dependencies
pip install -r requirements.txt

# 3. Configure environment
cp .env.example .env
# Fill in DATABASE_URL, JWT_SECRET_KEY, RAZORPAY, etc.

# 4. Start the Backend server
uvicorn app:app --host 0.0.0.0 --port 8000 --reload
```

Server will run at: http://localhost:8000
API Docs (Swagger): http://localhost:8000/docs
Admin Dashboard: http://localhost:8000/admin/login

## Environment Variables

See `.env.example` for full list and format details.

| Variable | Required | Description |
|----------|----------|-------------|
| `DATABASE_URL` | Yes | PostgreSQL connection string (Neon DB) |
| `JWT_SECRET_KEY` | Yes | Secret key for signing JWT tokens |
| `ML_SERVICE_URL` | Yes | URL of ML Service (default: http://localhost:8001) |
| `GEMINI_API_KEY` | Yes | Google Gemini API key for dataset understanding |
| `RAZORPAY_KEY_ID` | Yes | Razorpay API key ID |
| `RAZORPAY_KEY_SECRET` | Yes | Razorpay API key secret |
| `EMAIL_*` | Yes | SMTP configuration for OTP and password resets |

## Deployment (Render)

1. Create a **Web Service** on Render
2. Set **Root Directory** to `backend`
3. Set **Build Command**: `pip install -r requirements.txt`
4. Set **Start Command**: `uvicorn app:app --host 0.0.0.0 --port $PORT`
5. Add environment variables from `.env.example`
6. Ensure `ML_SERVICE_URL` points to your deployed ML Service on Render
