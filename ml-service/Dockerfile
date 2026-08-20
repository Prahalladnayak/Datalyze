# Datalyze ML Service — Dockerfile
# Optional: Use for containerized deployment on Render or RunPod

FROM python:3.11-slim

# Set working directory
WORKDIR /app

# Install system dependencies for scientific computing
RUN apt-get update && apt-get install -y \
    gcc \
    g++ \
    && rm -rf /var/lib/apt/lists/*

# Install Python dependencies
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Copy source code
COPY . .

# Expose ML Service port (default: 8001)
EXPOSE 8001

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=5s --retries=3 \
    CMD python -c "import urllib.request; urllib.request.urlopen('http://localhost:8001/health')"

# Start the ML Service
CMD ["uvicorn", "app:app", "--host", "0.0.0.0", "--port", "8001"]
