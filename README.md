# QnA Bot with Docs 💬📄

A production-grade, full-stack AI Document Q&A and Research Assistant built with **FastAPI**, **LangGraph**, **LangChain**, **Qdrant Vector Database**, **PostgreSQL / Supabase**, and **React (Vite)**.

---

## 🌟 Key Features

### 1. 🧠 Multi-Turn Adaptive RAG Engine
- **LangGraph State Machine**: Orchestrates query rewriting, intent classification, conditional vector retrieval routing, and streaming answer generation.
- **Resilient Dual-Model Architecture**:
  - **Primary Model**: Google Gemini (`gemini-3.6-flash` with native structured outputs).
  - **Fallback Model**: NVIDIA NIM (`nvidia/nemotron-3.5-lightning-30b-a3b` with schema recovery).

### 2. ⚡ Multi-Tenant Vector Architecture (Qdrant)
- **Zero Cross-Talk Isolation**: Each document chunk is strictly isolated per `user_id` and `conversation_id`.
- **Tenant-Optimized Indexing**: Utilizes Qdrant's `is_tenant: True` keyword payload indexing for sub-millisecond pre-filtered HNSW vector graph traversal.
- **High-Dimensional Embeddings**: Powered by Google's `models/gemini-embedding-001` (3072 dimensions, Cosine distance).
- **Automated Cascade Cleanups**: Deleting a document or entire conversation automatically cleans up PostgreSQL records, Object Storage files, and Qdrant vector chunks simultaneously.

### 3. 🚀 High-Performance Ingestion Pipeline
- **Direct-to-Storage Presigned Uploads**: Browser uploads directly to Object Storage (Supabase S3 / AWS S3 / Cloudflare R2) via presigned PUT URLs, offloading server bandwidth.
- **Asynchronous Background Processing**: Non-blocking background worker processes file parsing, semantic recursive chunking, and embedding generation.
- **Multi-Format In-Memory Loader**: Supports **PDF** (page-level extraction), **DOCX** (paragraphs & table extraction), **CSV** (row-level structuring), and **TXT/MD**.

### 4. 💬 Real-Time Streaming & Interactive Tree UI
- **Server-Sent Events (SSE)**: Incremental real-time token streaming with live pipeline phase indicators (*Analyzing query...*, *Searching knowledge base...*).
- **Interactive Conversation Tree**: Branch switching, inline prompt editing, message regeneration, and tree traversal.
- **Anonymous Sessions**: 24-hour anonymous session isolation via secure HttpOnly cookies.
- **Rich Aesthetics**: Glassmorphic dark/light UI with syntax highlighting and LaTeX math support.

---

## 🏗️ Architecture & Ingestion Flow

```mermaid
flowchart TD
    subgraph Client ["Frontend (React / Vite)"]
        UI[User / Upload Interface]
    end

    subgraph StorageEngine ["Object Storage & Vector DB"]
        S3[(S3 / Supabase Storage)]
        Qdrant[(Qdrant Cloud Vector Store)]
        Postgres[(PostgreSQL Database)]
    end

    subgraph BackendAPI ["FastAPI Core"]
        Router[API Routers]
        Ingestion[Ingestion Pipeline Worker]
        Graph[LangGraph RAG Engine]
    end

    UI -->|1. Presign Request| Router
    Router -->|2. Presigned PUT URL| UI
    UI -->|3. Direct Binary Upload| S3
    UI -->|4. Confirm Upload| Router
    Router -->|5. Queue Ingestion Task| Ingestion
    Ingestion -->|6. Download File| S3
    Ingestion -->|7. Parse & Chunk| Ingestion
    Ingestion -->|8. Embed 3072-dim| Qdrant
    Ingestion -->|9. Update Status: Success| Postgres

    UI -->|10. Query Turn| Graph
    Graph -->|11. Scoped Retrieval (user_id, conv_id)| Qdrant
    Graph -->|12. Stream SSE Answer| UI
```

---

## 🛠️ Tech Stack

| Domain | Technologies |
| :--- | :--- |
| **Backend Framework** | FastAPI, Pydantic v2, Uvicorn |
| **RAG & Agent Orchestration** | LangGraph, LangChain, LangChain-Qdrant, LangChain-Google-GenAI |
| **Vector Database** | Qdrant (Cloud / Self-Hosted) with Multi-Tenant Payload Indexing |
| **Relational Database** | PostgreSQL, SQLAlchemy 2.0 (Asyncio), Asyncpg |
| **Object Storage** | S3-Compatible API (`aioboto3`) supporting Supabase S3, AWS S3, Cloudflare R2 |
| **Frontend** | React 18, Vite, React Router 6, Tabler Icons, React Markdown, Highlight.js |
| **Observability** | LangSmith OpenTelemetry Tracing & Structured Rotating JSON Logging |

---

## 🚀 Getting Started

### 1. Prerequisites
- **Python 3.11+**
- **Node.js 18+** & **npm**
- **PostgreSQL Database** (e.g. Supabase)
- **Qdrant Cluster** (e.g. [Qdrant Cloud](https://cloud.qdrant.io/))
- **Google Gemini API Key**

---

### 2. Backend Setup

1. **Navigate to the backend directory**:
   ```bash
   cd backend
   ```

2. **Create and activate a virtual environment**:
   ```bash
   python -m venv .venv
   # Windows:
   .venv\Scripts\activate
   # Linux / macOS:
   source .venv/bin/activate
   ```

3. **Install dependencies**:
   ```bash
   pip install -r requirements.txt
   pip install pypdf python-docx langchain-qdrant qdrant-client
   ```

4. **Configure `.env`**:
   Create a `.env` file in the `backend/` directory:
   ```env
   # Database
   DATABASE_URL="postgresql+asyncpg://postgres:password@localhost:5432/postgres"

   # LLM Providers
   GEMINI_API_KEY="your-gemini-api-key"
   NVIDIA_API_KEY="your-nvidia-api-key"

   # Qdrant Vector Store
   QDRANT_URL="https://your-cluster.us-east-1-0.aws.cloud.qdrant.io:6333"
   QDRANT_API_KEY="your-qdrant-api-key"
   COLLECTION_NAME="chat_with_docs"

   # Object Storage (Supabase S3 / AWS S3)
   STORAGE_BUCKET_NAME="documents"
   STORAGE_REGION="us-east-1"
   STORAGE_ENDPOINT_URL="https://your-project-id.storage.supabase.co/storage/v1/s3"
   STORAGE_ACCESS_KEY_ID="your-access-key-id"
   STORAGE_SECRET_ACCESS_KEY="your-secret-access-key"

   # Optional Observability
   LANGCHAIN_TRACING_V2="true"
   LANGCHAIN_API_KEY="your-langsmith-key"
   ```

5. **Start the backend server**:
   ```bash
   python -m uvicorn app.main:app --host 127.0.0.1 --port 8000 --reload
   ```

---

### 3. Frontend Setup

1. **Navigate to the frontend directory**:
   ```bash
   cd frontend
   ```

2. **Install dependencies**:
   ```bash
   npm install
   ```

3. **Start the development server**:
   ```bash
   npm run dev
   ```
   Open [http://localhost:5173](http://localhost:5173) in your browser.

---

## 📡 Key API Endpoints

- `POST /api/v1/conversations/draft` — Create a new conversation
- `DELETE /api/v1/conversations/{conversation_id}` — Cascade delete conversation, messages, S3 files, and Qdrant vectors
- `POST /api/v1/conversations/{conversation_id}/messages/` — Send prompt & stream SSE tokens
- `POST /api/v1/conversations/{conversation_id}/documents/presign` — Generate presigned upload URL
- `POST /api/v1/conversations/{conversation_id}/documents/{document_id}/confirm` — Trigger background RAG ingestion pipeline
- `DELETE /api/v1/conversations/{conversation_id}/documents/{document_id}` — Delete document & vector embeddings
- `GET /docs` — Interactive OpenAPI / Swagger UI

---

## 📄 License

MIT License.
