FROM python:3.12-slim

WORKDIR /app

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Pre-bake the fastembed ONNX model into the image layer so there is no
# network download at runtime. Uses ~130MB image space but eliminates cold-start delay.
ENV FASTEMBED_CACHE_DIR=/opt/fastembed
RUN python -c "\
from fastembed import TextEmbedding; \
TextEmbedding('sentence-transformers/paraphrase-multilingual-MiniLM-L12-v2', cache_dir='/opt/fastembed')"

COPY . .

EXPOSE 8000

CMD ["sh", "-c", "uvicorn app.main:app --host 0.0.0.0 --port ${PORT:-8000} --workers 1"]
