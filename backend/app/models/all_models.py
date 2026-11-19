from datetime import datetime, timezone
from typing import List, Optional
from sqlalchemy import Column, Integer, String, Boolean, ForeignKey, DateTime, Float, Text, Enum as SQLEnum, JSON
from sqlalchemy.orm import relationship
from pgvector.sqlalchemy import Vector
from app.core.database import Base
from app.core.config import settings

import enum


class RoleEnum(str, enum.Enum):
    ADMIN = "admin"
    MANAGER = "manager"
    VIEWER = "viewer"


class ConfidentialityLevel(str, enum.Enum):
    PUBLIC = "Public"
    INTERNAL = "Internal"
    CONFIDENTIAL = "Confidential"
    RESTRICTED = "Restricted"


class DocumentStatus(str, enum.Enum):
    PENDING = "PENDING"
    PROCESSING = "PROCESSING"
    READY = "READY"
    FAILED = "FAILED"


class User(Base):
    __tablename__ = "users"

    id = Column(Integer, primary_key=True, index=True)
    email = Column(String(255), unique=True, index=True, nullable=False)
    hashed_password = Column(String(255), nullable=False)
    full_name = Column(String(255), nullable=False)
    role = Column(String(50), default="viewer", nullable=False)  # admin, manager, viewer
    department = Column(String(100), default="General", nullable=False)  # HR, Finance, Operations, Engineering, Legal, General
    is_active = Column(Boolean, default=True)
    created_at = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc))

    documents = relationship("Document", back_populates="owner")
    audit_logs = relationship("AuditLog", back_populates="user")


class Document(Base):
    __tablename__ = "documents"

    id = Column(Integer, primary_key=True, index=True)
    title = Column(String(255), nullable=False, index=True)
    department = Column(String(100), nullable=False, index=True)
    owner_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    confidentiality_level = Column(String(50), default="Internal", nullable=False)
    tags = Column(String(500), default="")  # comma separated tags
    current_version_number = Column(Integer, default=1)
    status = Column(String(50), default=DocumentStatus.PENDING.value)
    created_at = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc))
    updated_at = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc), onupdate=lambda: datetime.now(timezone.utc))

    owner = relationship("User", back_populates="documents")
    versions = relationship("DocumentVersion", back_populates="document", cascade="all, delete-orphan")


class DocumentVersion(Base):
    __tablename__ = "document_versions"

    id = Column(Integer, primary_key=True, index=True)
    document_id = Column(Integer, ForeignKey("documents.id"), nullable=False, index=True)
    version_number = Column(Integer, nullable=False)
    file_path = Column(String(500), nullable=False)
    file_name = Column(String(255), nullable=False)
    file_size_bytes = Column(Integer, default=0)
    file_type = Column(String(50), nullable=False)  # pdf, docx, xlsx, etc.
    content_summary = Column(Text, nullable=True)  # first chunk preview, or the failure reason
    # Per-version ingestion status. The document's current_version_number only
    # advances to a version once it is READY, so a re-upload never hides the
    # previous working version from search.
    status = Column(String(50), default=DocumentStatus.PENDING.value, nullable=False)
    upload_date = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc))

    document = relationship("Document", back_populates="versions")
    chunks = relationship("DocumentChunk", back_populates="version", cascade="all, delete-orphan")


class DocumentChunk(Base):
    """
    Vector chunks indexed with pgvector for Hybrid Retrieval.
    """
    __tablename__ = "document_chunks"

    id = Column(Integer, primary_key=True, index=True)
    document_id = Column(Integer, ForeignKey("documents.id"), nullable=False, index=True)
    version_id = Column(Integer, ForeignKey("document_versions.id"), nullable=False, index=True)
    chunk_index = Column(Integer, nullable=False)
    content = Column(Text, nullable=False)
    section_title = Column(String(255), nullable=True)
    page_number = Column(Integer, default=1)
    token_count = Column(Integer, default=0)
    embedding = Column(Vector(settings.EMBEDDING_DIMENSION), nullable=True)
    metadata_json = Column(JSON, default=dict)

    version = relationship("DocumentVersion", back_populates="chunks")


class SupplierContract(Base):
    """
    Structured data table for SQL + RAG integration.
    """
    __tablename__ = "supplier_contracts"

    id = Column(Integer, primary_key=True, index=True)
    supplier_name = Column(String(255), unique=True, index=True, nullable=False)
    contract_number = Column(String(100), unique=True, nullable=False)
    contract_start = Column(DateTime(timezone=True), nullable=False)
    contract_end = Column(DateTime(timezone=True), nullable=False)
    payment_terms_days = Column(Integer, default=30)
    penalty_clause_summary = Column(Text, nullable=False)
    status = Column(String(50), default="Active")


class PaymentHistory(Base):
    """
    Structured data table tracking invoice delays for SQL + RAG queries.
    """
    __tablename__ = "payment_history"

    id = Column(Integer, primary_key=True, index=True)
    invoice_number = Column(String(100), unique=True, index=True, nullable=False)
    supplier_name = Column(String(255), ForeignKey("supplier_contracts.supplier_name"), nullable=False, index=True)
    amount_usd = Column(Float, nullable=False)
    due_date = Column(DateTime(timezone=True), nullable=False)
    paid_date = Column(DateTime(timezone=True), nullable=True)
    status = Column(String(50), default="Paid")  # Paid, Delayed, Pending
    delay_days = Column(Integer, default=0)


class AuditLog(Base):
    __tablename__ = "audit_logs"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=True, index=True)
    user_email = Column(String(255), nullable=True)
    action = Column(String(100), nullable=False)  # UPLOAD, SEARCH, CHAT, VIEW_DOC, COMPARE_VERSIONS
    resource_type = Column(String(100), nullable=False)  # Document, Chat, System
    resource_id = Column(String(100), nullable=True)
    details = Column(Text, nullable=True)
    timestamp = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc), index=True)

    user = relationship("User", back_populates="audit_logs")


class SearchAnalytics(Base):
    __tablename__ = "search_analytics"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, nullable=True, index=True)
    query_text = Column(Text, nullable=False)
    retrieval_method = Column(String(50), default="Hybrid (Dense + BM25)")
    top_document_ids = Column(String(255), nullable=True)  # comma separated IDs
    latency_ms = Column(Float, nullable=False)
    result_count = Column(Integer, default=0)
    timestamp = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc), index=True)
