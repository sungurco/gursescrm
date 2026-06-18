FROM python:3.11-slim

# System deps for bcrypt/cryptography
RUN apt-get update && apt-get install -y --no-install-recommends \
    build-essential \
    libffi-dev \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

COPY requirements.txt .
RUN pip install --no-cache-dir --upgrade pip && \
    pip install --no-cache-dir -r requirements.txt \
        --extra-index-url https://d33sy5i8bnduwe.cloudfront.net/simple/

COPY . .

# Persistent data directory for uploaded files (mounted as volume)
RUN mkdir -p /data/uploads

EXPOSE 8001

CMD ["uvicorn", "server:app", "--host", "0.0.0.0", "--port", "8001"]
