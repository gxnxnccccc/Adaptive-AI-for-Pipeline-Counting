FROM python:3.12-slim

ENV PYTHONUNBUFFERED=1 PYTHONDONTWRITEBYTECODE=1
WORKDIR /app

# opencv-python-headless ships manylinux wheels with no GUI deps, so no apt libs are needed on slim.
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY app ./app

# Demo mode: no Supabase keys needed, data lives in RAM (lost on restart).
ENV DEMO_MEMORY=true
RUN useradd --system --uid 10001 appuser
USER appuser

EXPOSE 8000
CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000"]
