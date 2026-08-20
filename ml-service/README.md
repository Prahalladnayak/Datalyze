# Datalyze ML Service

Standalone ML compute microservice for the Datalyze platform.

## Responsibilities

- Supervised learning (Classification, Regression) via scikit-learn
- Clustering (KMeans, DBSCAN, Agglomerative)
- Deep Learning simulation and RunPod GPU dispatch
- NLP Transformer simulation and RunPod GPU dispatch

## Architecture

```
Frontend → Backend → ML Service
                  ↑
          (this service)
```

The ML Service **never** receives requests from the Frontend directly.
All requests come from the Backend after authentication and credit validation.

## Local Development

```bash
# 1. Create virtual environment
python -m venv .venv
.venv\Scripts\activate        # Windows
# source .venv/bin/activate   # macOS/Linux

# 2. Install dependencies
pip install -r requirements.txt

# 3. Configure environment
cp .env.example .env
# Edit .env with your GPU credentials (optional — simulation works without them)

# 4. Start the service
uvicorn app:app --host 0.0.0.0 --port 8001 --reload
```

Service will be available at: http://localhost:8001

## API Endpoints

| Method | Path | Description |
|--------|------|-------------|
| GET | `/health` | Health check + GPU config status |
| POST | `/train/run` | Run classification/regression/clustering |
| POST | `/train/cluster` | Run dedicated clustering |
| POST | `/automl/run-dl` | Run Deep Learning AutoML |
| POST | `/automl/run-nlp` | Run NLP AutoML |

## Environment Variables

See `.env.example` for full documentation.

| Variable | Required | Description |
|----------|----------|-------------|
| `GPU_PROVIDER` | No | GPU provider (default: runpod) |
| `GPU_API_KEY` | No | RunPod API key (simulation if empty) |
| `GPU_ENDPOINT` | No | RunPod endpoint ID or URL |
| `GPU_WEBHOOK_SECRET` | No | Webhook verification secret |
| `GPU_MAX_RUNTIME` | No | Max job wait time in seconds (default: 600) |

## Deployment (Render)

1. Create a new **Web Service** on Render
2. Set **Root Directory** to `ml-service`
3. Set **Build Command**: `pip install -r requirements.txt`
4. Set **Start Command**: `uvicorn app:app --host 0.0.0.0 --port $PORT`
5. Add environment variables from `.env.example`
6. Set `BACKEND_URL` to your Backend's Render URL

## Migration to RunPod (GPU)

When ready for real GPU training:
1. Deploy your ML worker to RunPod Serverless
2. Update `GPU_API_KEY` and `GPU_ENDPOINT` in ML Service `.env`
3. No Backend changes required — the ML Service handles GPU dispatch transparently
