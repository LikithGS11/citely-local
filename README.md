# Enterprise AI Knowledge Intelligence Platform (Production-Grade RAG)

A production-grade, highly scalable **Enterprise AI Knowledge Intelligence Platform** architected with **FastAPI**, **PostgreSQL (`pgvector`)**, **Celery + Redis**, **Next.js 14**, and **Hybrid Retrieval-Augmented Generation (RAG)**. This system goes far beyond simple PDF chat applications to provide real-world, secure organizational knowledge discovery and reasoning.

---

## 🌟 Key Architectural Capabilities & Core Features

### 1. Granular Enterprise Security & RBAC
- **JWT Authentication** with Department-level and Document-level permissions (`HR`, `Finance`, `Operations`, `Legal`, `General`).
- Role-Based Access Control (`Admin`, `Manager`, `Viewer`) enforced across both API endpoints and vector search queries.
- **Audit Logging** tracking every document upload, version comparison, search query, and AI conversation.

### 2. Multi-Format Intelligent Document Processing & OCR
- Supports uploading **PDF, DOCX, PPTX, XLSX, CSV, TXT, Markdown, Images, and Scanned PDFs**.
- Automatic text cleaning, semantic chunking (`RecursiveCharacterTextSplitter`), and metadata tagging (Title, Department, Confidentiality Level, Versioning, Tags).
- **Asynchronous Celery Workers** handle heavy processing, embedding generation, and vector indexing in the background without blocking the UI.

### 3. State-of-the-Art Hybrid Retrieval & Reranking
- Combines **Dense Vector Search** (`pgvector` cosine similarity with `all-MiniLM-L6-v2` / `BGE` embeddings) and **Keyword Search** (Postgres `BM25` / `to_tsvector`).
- Applies **Reciprocal Rank Fusion (RRF)** and relevance reranking with department and confidentiality level filtering before feeding context to the AI.

### 4. Multi-Agent AI Orchestration & SQL+RAG Unified Workflow
- **Coordinator Agent**: Dynamically classifies user intent and delegates tasks to specialized sub-agents.
- **Retrieval Agent**: Synthesizes exact, interactive **Source Citations** (`Document Name`, `Page Number`, `Section`).
- **SQL Agent**: Connects to structured PostgreSQL business tables (`PaymentHistory`, `SupplierContracts`) to translate natural language into safe, read-only SQL queries.
- **Unified SQL + RAG Engine**: Seamlessly answers hybrid queries such as *"Which supplier has the highest delayed payments, and what do their contracts say about penalties?"* by combining database aggregations with RAG contract retrieval.

### 5. Multi-Turn Conversation Memory & Version Control
- Tracks multi-turn dialogue history so users can ask follow-up questions naturally (e.g., *"Summarize Supplier ABC's contract."* -> *"What are the payment terms?"*).
- Complete **Document Versioning** allowing users to upload updated versions (`v1.0`, `v2.0`), track changelogs, and view side-by-side content comparisons.

### 6. Executive Analytics & Semantic Search Hub
- Dedicated **Semantic Search Interface** for instant document discovery without chatbot interaction.
- Real-time **Analytics Dashboard** monitoring most searched documents, departmental queries, AI response latency, and retrieval accuracy.

---

## 🛠️ Technology Stack

| Layer | Technologies |
| :--- | :--- |
| **Backend Framework** | Python 3.11+, FastAPI, Pydantic v2, SQLAlchemy 2.0 (Async) |
| **Database & Vector Store** | PostgreSQL 16 + `pgvector` extension, Asyncpg |
| **Caching & Message Broker** | Redis 7, Celery Background Workers |
| **AI / RAG Pipeline** | Sentence Transformers (`all-MiniLM-L6-v2`), OpenAI API / Local Simulation Engine, BM25, LangChain |
| **Document Processing** | PyMuPDF (`fitz`), `python-docx`, `openpyxl`, `pytesseract` (OCR), Pillow |
| **Frontend Web App** | Next.js 14 (App Router), TypeScript, Tailwind CSS, Lucide Icons, Framer Motion, Recharts |
| **Containerization** | Docker, Docker Compose |

---

## 🚀 Quick Start & Deployment

### Option 1: Docker Compose (Recommended for Full Stack)
Ensure Docker and Docker Compose are installed, then run from the project root:
```bash
docker-compose up -d --build
```
- **Frontend App**: `http://localhost:3000`
- **Backend API Docs**: `http://localhost:8000/docs`
- **PostgreSQL**: `localhost:5432` (`enterprise_rag`)
- **Redis**: `localhost:6379`

### Option 2: Local Development Setup

#### 1. Start PostgreSQL (`pgvector`) & Redis
You can use Docker to spin up just the database services:
```bash
docker-compose up -d postgres redis
```

#### 2. Backend Setup & Database Seeding
Open a terminal inside the `backend/` folder:
```bash
cd backend
python -m venv venv
# On Windows: venv\Scripts\activate | On macOS/Linux: source venv/bin/activate
pip install -r requirements.txt

# Run database setup & automated enterprise seeding
python -m scripts.seed_data

# Start FastAPI server
uvicorn app.main:app --host 0.0.0.0 --port 8000 --reload
```
*Note: In another terminal window, start the Celery worker:*
```bash
cd backend
celery -A app.core.celery_app worker --loglevel=info -c 2
```

#### 3. Frontend Setup
Open a terminal inside the `frontend/` folder:
```bash
cd frontend
npm install
npm run dev
```
Open `http://localhost:3000` to access the platform!

---

## 👥 Demo Accounts (Pre-Seeded)

When you run `python -m scripts.seed_data`, the following test accounts are automatically created with complete role hierarchies and sample documents:

| Email | Password | Role | Department | Access Scope |
| :--- | :--- | :--- | :--- | :--- |
| `admin@enterprise.ai` | `Enterprise2026!` | **Admin** | General / All | Full access across all departments & confidentiality levels (`Restricted`) |
| `hr@enterprise.ai` | `Enterprise2026!` | **Manager** | HR | Access to HR department docs & HR policies (`Confidential`) |
| `finance@enterprise.ai` | `Enterprise2026!` | **Manager** | Finance | Access to Finance docs, Supplier Contracts, and SQL Payment tables (`Confidential`) |
| `engineer@enterprise.ai` | `Enterprise2026!` | **Viewer** | Engineering | Access to Engineering documentation & public guidelines (`Internal`) |

---

## 💡 Sample Enterprise Queries to Test

1. **Policy & SOP Retrieval (Hybrid RAG + Citations)**:
   > *"What is the maternity leave policy for full-time employees, and how many weeks are paid?"*
2. **Unified SQL + RAG Workflow (Database + Document Reasoning)**:
   > *"Which supplier has the highest delayed payments, and what do their contracts say about late payment penalty clauses?"*
3. **Multi-Turn Conversation Memory**:
   > **Turn 1**: *"Summarize Supplier ABC's master agreement."*  
   > **Turn 2**: *"What are their payment terms and termination conditions?"*
4. **Operational & Technical Search**:
   > *"Explain the warehouse receiving process and quality inspection checklist."*
