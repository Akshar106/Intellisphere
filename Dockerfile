FROM python:3.10-slim

WORKDIR /app

RUN apt-get update && apt-get install -y \
    gcc \
    g++ \
    build-essential \
    && rm -rf /var/lib/apt/lists/*

COPY requirements.txt .

RUN pip install --no-cache-dir -r requirements.txt

COPY main.py .
COPY db.py .
COPY download.py .
COPY embeddings/ ./embeddings/
COPY static/ ./static/
COPY templates/ ./templates/


ENV PYTHONUNBUFFERED=1
ENV FLASK_APP=main.py

EXPOSE 5000

CMD ["python", "main.py"]