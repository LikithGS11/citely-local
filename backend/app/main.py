import logging
import time
from contextlib import asynccontextmanager
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from app.core.config import settings
from app.core.database import init_db, check_db
from app.ai.embeddings import embedding_service
from app.api.v1 import documents, chat, search, analytics

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s - %(name)s - %(levelname)s - %(message)s"
)
logger = logging.getLogger(__name__)


@asynccontextmanager
async def lifespan(app: FastAPI):
    logger.info("Starting up Citely API server...")
    await init_db()
    yield


app = FastAPI(
    title=settings.PROJECT_NAME,
    version=settings.VERSION,
    description="Citely: ask your documents, get cited answers. Hybrid RAG (pgvector + BM25) and a local Ollama LLM.",
    docs_url="/docs",
    redoc_url="/redoc",
    lifespan=lifespan
)

# Authentication is disabled, so CORS is the only thing stopping other websites
# open in your browser from calling this API. Only the frontend origin is allowed.
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.CORS_ORIGINS,
    allow_credentials=False,
    allow_methods=["GET", "POST", "DELETE"],
    allow_headers=["*"],
)

# Register API Routers (authentication disabled — all endpoints are open)
app.include_router(documents.router, prefix=settings.API_V1_STR)
app.include_router(chat.router, prefix=settings.API_V1_STR)
app.include_router(search.router, prefix=settings.API_V1_STR)
app.include_router(analytics.router, prefix=settings.API_V1_STR)


@app.get("/", tags=["System Health"])
async def root():
    return {
        "project": settings.PROJECT_NAME,
        "version": settings.VERSION,
        "llm_provider": settings.LLM_PROVIDER,
        "embedding_model": settings.EMBEDDING_MODEL,
        "health": "/health",
        "api_docs": "/docs"
    }


@app.get("/health", tags=["System Health"])
async def health_check():
    """Reports real dependency status; 503 if the database or embedding model is unusable."""
    db_error = await check_db()
    embed_error = embedding_service.unavailable_reason
    body = {
        "status": "ok" if not (db_error or embed_error) else "degraded",
        "database": "ok" if not db_error else db_error,
        "embedding_model": "ok" if not embed_error else embed_error,
        "timestamp": time.time(),
    }
    return JSONResponse(body, status_code=200 if body["status"] == "ok" else 503)
