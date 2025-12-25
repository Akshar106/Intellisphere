FROM python:3.11-slim

WORKDIR /app

# System deps
RUN apt-get update && apt-get install -y \
    gcc \
    g++ \
    build-essential \
    curl \
    unzip \
    && rm -rf /var/lib/apt/lists/*

# Install AWS CLI v2
RUN curl "https://awscli.amazonaws.com/awscli-exe-linux-x86_64.zip" -o "awscliv2.zip" && \
    unzip awscliv2.zip && \
    ./aws/install && \
    rm -rf awscliv2.zip aws

# Python deps
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# App code
COPY main.py .
COPY static/ ./static/
COPY templates/ ./templates/

# FAISS directory
RUN mkdir -p /app/faiss_index

# Env
ENV PYTHONUNBUFFERED=1
ENV FLASK_ENV=production
ENV FAISS_BASE_DIR=/app/faiss_index

EXPOSE 5000

# ⬇️ Download FAISS at container startup
CMD aws s3 sync s3://${S3_BUCKET}/${S3_PREFIX}/ ${FAISS_BASE_DIR}/ && \
    gunicorn --bind 0.0.0.0:5000 --workers 2 --timeout 120 main:app
