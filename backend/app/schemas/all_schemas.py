from datetime import datetime
from typing import Optional, List, Dict, Any
from pydantic import BaseModel, ConfigDict, Field


# ==================== User Schemas (auth disabled) ====================
class UserResponse(BaseModel):
    id: int
    email: str
    full_name: str
    role: str
    department: str
    is_active: bool
    created_at: datetime

    model_config = ConfigDict(from_attributes=True)


# ==================== Document Schemas ====================
class DocumentCreateMetadata(BaseModel):
    title: str
    department: str = "General"
    confidentiality_level: str = "Internal"  # Public, Internal, Confidential, Restricted
    tags: Optional[str] = ""


class DocumentVersionResponse(BaseModel):
    id: int
    document_id: int
    version_number: int
    file_name: str
    file_size_bytes: int
    file_type: str
    content_summary: Optional[str] = None
    upload_date: datetime

    model_config = ConfigDict(from_attributes=True)


class DocumentResponse(BaseModel):
    id: int
    title: str
    department: str
    owner_id: int
    confidentiality_level: str
    tags: str
    current_version_number: int
    status: str
    created_at: datetime
    updated_at: datetime
    versions: List[DocumentVersionResponse] = []

    model_config = ConfigDict(from_attributes=True)


class VersionComparisonResponse(BaseModel):
    document_id: int
    document_title: str
    version_1: int
    version_2: int
    diff_summary: str
    added_sections: List[str]
    removed_sections: List[str]
    changed_metrics: Dict[str, Any]


# ==================== Search & Citation Schemas ====================
class ChunkCitation(BaseModel):
    chunk_id: int
    document_id: int
    document_title: str
    page_number: int
    section_title: Optional[str] = "General"
    content_snippet: str
    similarity_score: float
    confidentiality_level: str


class SearchRequest(BaseModel):
    query: str = Field(..., min_length=2)
    department_filter: Optional[str] = None
    confidentiality_filter: Optional[str] = None
    top_k: int = 5


class SearchResponse(BaseModel):
    query: str
    results: List[ChunkCitation]
    total_results: int
    retrieval_method: str = "Hybrid (Dense Vector + BM25 + Rerank)"
    latency_ms: float


# ==================== AI Chat Schemas ====================
class ChatMessage(BaseModel):
    role: str  # user, assistant, system
    content: str


class ChatRequest(BaseModel):
    message: str = Field(..., min_length=2)
    conversation_id: Optional[str] = "default"
    history: List[ChatMessage] = []


class AgentThoughtStep(BaseModel):
    agent_name: str  # Coordinator Agent, Retrieval Agent, SQL Agent, Summarization Agent
    action: str
    details: str
    timestamp: float


class ChatResponse(BaseModel):
    answer: str
    citations: List[ChunkCitation]
    agent_steps: List[AgentThoughtStep]
    unified_data: Optional[Dict[str, Any]] = None  # Contains SQL table results when SQL+RAG is invoked
    latency_ms: float


# ==================== Analytics Schemas ====================
class AnalyticsSummaryResponse(BaseModel):
    total_documents: int
    total_users: int
    total_search_queries: int
    average_latency_ms: float
    retrieval_accuracy_rating: Optional[float] = None  # None = not measured
    top_queried_documents: List[Dict[str, Any]]
    department_usage: List[Dict[str, Any]]
    recent_queries: List[Dict[str, Any]]
