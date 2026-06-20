FROM python:3.12-slim

WORKDIR /app

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Cache the multilingual embedder used to create the XGBoost model's 384 text features.
ARG SENTENCE_TRANSFORMER_MODEL=paraphrase-multilingual-MiniLM-L12-v2
ENV SENTENCE_TRANSFORMER_MODEL=$SENTENCE_TRANSFORMER_MODEL
ENV HF_HOME=/opt/huggingface
RUN python -c "import os; from sentence_transformers import SentenceTransformer; SentenceTransformer(os.environ['SENTENCE_TRANSFORMER_MODEL'])"

COPY . .

EXPOSE 8000

CMD ["sh", "-c", "uvicorn app.main:app --host 0.0.0.0 --port ${PORT:-8000} --workers 1"]
