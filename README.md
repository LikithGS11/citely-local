# Citely

**Ask your documents, get cited answers.**

Citely is a local, single-user document assistant: upload documents, search them with hybrid retrieval, and ask questions answered by a local LLM (Ollama) with page-level citations.

**Stack:** FastAPI · PostgreSQL 16 + `pgvector` · Celery + Redis · Sentence Transformers · Ollama · Next.js 14

**License:** MIT

> **No authentication.** Every request runs as one local admin user. The API only accepts browser calls from the frontend origin (`CORS_ORIGINS`) and the launcher binds it to `127.0.0.1`. Don't expose it on a network.

---

## What it does

### Document ingestion
- Upload **PDF, DOCX, PPTX, XLSX, CSV, TXT, Markdown, PNG/JPG**. Legacy `.doc`/`.xls` are rejected.
- Scanned PDF pages and images are OCR'd with Tesseract (must be installed on the server).
- Text is split into ~800-character chunks (`RecursiveCharacterTextSplitter`), embedded with `all-MiniLM-L6-v2`, and stored in pgvector.
- Work runs in a Celery worker. If Redis is down it runs in-process in a background thread.
- If parsing fails or there is no extractable text, the version is marked **FAILED** with the reason. Nothing is indexed.
- If the embedding model can't load, ingestion and search fail loudly (HTTP 503 / FAILED). There are no fake vectors.

### Versioning
- Uploading a new version keeps the previous version **searchable until the new one finishes ingesting**. If the new version fails, the old one keeps serving.
- Two ingested versions can be compared by section headers and chunk counts.

### Retrieval
1. pgvector cosine search (HNSW index) pulls the top 50 candidate chunks from the current version of each READY document.
2. BM25 scores those candidates by keyword.
3. Reciprocal Rank Fusion merges both rankings, with a small boost when query words appear in the title or section heading.
4. The similarity percentage shown is the real cosine similarity.

### Chat
- An LLM classifier (keyword fallback) routes each question to one of two fixed pipelines:
  - **RAG:** hybrid retrieval, then the LLM answers from the retrieved chunks with citations.
  - **SQL + RAG:** a fixed read-only query for delayed invoices in `payment_history` (worst 25), plus contract retrieval for the worst supplier, then a combined answer. This is not free-form text-to-SQL.
- The last 8 messages are sent as conversation history. Ollama runs with `num_ctx=8192` so prompts aren't silently truncated.
- If the LLM is unreachable, the answer is the raw retrieved text, clearly labelled. Nothing is made up.

### Analytics
- Every chat question and direct search is logged. The dashboard shows real counts, latency, top documents, and recent queries. Retrieval accuracy is shown as "not measured".

---

## Running it

### One click (Windows)
Double-click **`RAG Launcher.bat`**. It starts Postgres + Redis (WSL), the API on `127.0.0.1:8000`, a Celery worker (`-P solo`), and the frontend on `:3000`. Ollama must already be running.

### Manually
```bash
# 1. Start PostgreSQL 16 (with the pgvector extension) and Redis.
#    The launcher runs both inside WSL Ubuntu; any local install works.

# 2. Backend
cd backend
python -m venv venv
venv\Scripts\activate            # macOS/Linux: source venv/bin/activate
pip install -r requirements-dev.txt
uvicorn app.main:app --host 127.0.0.1 --port 8000

# 3. Worker (separate terminal; on Windows add -P solo)
celery -A app.core.celery_app worker --loglevel=info

# 4. Frontend
cd frontend
npm install
npm run dev
```

### Ollama
```bash
ollama pull gemma3:4b
```
Set `OLLAMA_MODEL` in `.env` to use a different model. See `.env.example` for every setting.

### Optional sample data
`python -m scripts.seed_data` (from `backend/`) creates sample supplier and payment tables for the SQL + RAG route, plus a few sample documents.

### Tests
```bash
cd backend
pytest
```

### Health
`GET /health` returns 200 only when the database and embedding model are both usable. Otherwise it returns 503 with the reason.

---

## Notes and limits
- **Schema changes:** there are no Alembic migrations. `init_db()` creates tables and applies small in-place upgrades. Changing `EMBEDDING_MODEL` or `EMBEDDING_DIMENSION` means dropping `document_chunks` and re-ingesting. A mismatch is reported by `/health` at startup.
- **Chat history** is saved in Postgres (`chat_messages`), so conversations survive restarts. Clearing the chat in the UI deletes it.
- **Deleting a document** removes all its versions, its search index, and its uploaded files. It's refused while a version is still processing.
- **SQL + RAG** runs one fixed query (delayed invoices). It is not general text-to-SQL.
- **DOCX** has no fixed pages, so DOCX citations point to the section heading (page is always 1).
