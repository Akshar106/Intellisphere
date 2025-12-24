FROM python:3.11-slim

WORKDIR /app

# Install system dependencies including AWS CLI
RUN apt-get update && apt-get install -y \
    gcc \
    g++ \
    build-essential \
    curl \
    unzip \
    && rm -rf /var/lib/apt/lists/*

# Install AWS CLI
RUN curl "https://awscli.amazonaws.com/awscli-exe-linux-x86_64.zip" -o "awscliv2.zip" && \
    unzip awscliv2.zip && \
    ./aws/install && \
    rm -rf awscliv2.zip aws

# Copy requirements and install Python dependencies
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Copy application files (NO FAISS INDEXES!)
COPY main.py .
COPY static/ ./static/
COPY templates/ ./templates/

# Create directory for FAISS indexes (will be downloaded at runtime)
RUN mkdir -p faiss_index/health faiss_index/law faiss_index/general

# Set environment variables
ENV PYTHONUNBUFFERED=1
ENV FLASK_APP=main.py
ENV FLASK_ENV=production

# Expose port
EXPOSE 5000

# Download FAISS indexes from S3 on container start, then run app
CMD aws s3 sync s3://intellisphere-faiss-indexes/faiss_index/ ./faiss_index/ && \
    gunicorn --bind 0.0.0.0:5000 --workers 4 --timeout 120 main:app
