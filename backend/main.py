import os
import shutil
from typing import Optional, List
from uuid import uuid4

import yaml
from dotenv import load_dotenv
from fastapi import FastAPI, File, HTTPException, UploadFile, Form
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import StreamingResponse
from pydantic import BaseModel

from app.services.agent_service import AgentService
from app.services.monitor_service import MonitorService
from app.services.rag_service import RAGService
from app.services.graph_service import GraphService # Import GraphService
from database import db

env_path = os.path.join(os.path.dirname(__file__), ".env")
if os.path.exists(env_path):
    load_dotenv(env_path)
else:
    load_dotenv()

app = FastAPI()

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

rag_service = RAGService()
agent_service = AgentService()
monitor_service = MonitorService(rag_service)
graph_service = GraphService() # Initialize GraphService


@app.on_event("startup")
async def startup_event():
    monitor_service.start()


@app.on_event("shutdown")
async def shutdown_event():
    monitor_service.stop()


class QueryRequest(BaseModel):
    query: str
    top_k: Optional[int] = 3


class ChatRequest(BaseModel):
    message: str
    session_id: Optional[str] = None
    mentions: Optional[List[str]] = []


class SessionCreateRequest(BaseModel):
    title: str = "New Chat"


class ConfigUpdateRequest(BaseModel):
    agent_prompt: str
    rag_settings: dict
    model_settings: dict

class KBCreateRequest(BaseModel):
    name: str
    description: Optional[str] = ""

class KGGenerateRequest(BaseModel):
    kb_ids: List[str]
    max_nodes: Optional[int] = 50
    granularity: Optional[str] = "fine"


class AgentSaveRequest(BaseModel):
    name: str
    nodes: List[dict]
    edges: List[dict]


@app.get("/")
async def read_root():
    return {"message": "Hello from FastAPI backend"}


@app.post("/api/sessions")
async def create_session(request: SessionCreateRequest):
    session_id = db.create_session(request.title)
    return {"id": session_id, "title": request.title}


@app.get("/api/sessions")
async def get_sessions():
    return db.get_sessions()


@app.get("/api/sessions/{session_id}")
async def get_session_messages(session_id: str):
    return db.get_session_messages(session_id)


@app.delete("/api/sessions/{session_id}")
async def delete_session(session_id: str):
    try:
        db.delete_session(session_id)
        return {"status": "success", "message": "Session deleted"}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.get("/api/config")
async def get_config():
    config_path = os.path.join(os.path.dirname(__file__), "config.yaml")
    if os.path.exists(config_path):
        with open(config_path, "r", encoding="utf-8") as f:
            return yaml.safe_load(f)
    return {}


@app.post("/api/config")
async def update_config(config: ConfigUpdateRequest):
    config_path = os.path.join(os.path.dirname(__file__), "config.yaml")
    with open(config_path, "w", encoding="utf-8") as f:
        yaml.dump(config.dict(), f, allow_unicode=True)
    
    # Reload agent service to apply changes
    agent_service.reload_config()
    return {"status": "success", "message": "Config updated"}


@app.post("/api/ingest")
async def ingest(file: UploadFile = File(...)):
    uploads_dir = os.path.join(os.path.dirname(__file__), "uploads")
    os.makedirs(uploads_dir, exist_ok=True)
    original_name = file.filename or "uploaded_file"
    _, ext = os.path.splitext(original_name)
    unique_name = f"{uuid4().hex}{ext}"
    save_path = os.path.join(uploads_dir, unique_name)
    try:
        with open(save_path, "wb") as buffer:
            shutil.copyfileobj(file.file, buffer)
    except Exception:
        raise HTTPException(status_code=500, detail="Failed to save uploaded file")
    absolute_path = os.path.abspath(save_path)
    try:
        rag_service.ingest_file(absolute_path)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc))
    except Exception:
        raise HTTPException(status_code=500, detail="Failed to ingest file into RAG")
    return {"status": "success", "filename": original_name}


@app.post("/api/query")
async def query(request: QueryRequest):
    docs = rag_service.query(request.query, top_k=request.top_k or 3)
    return {
        "results": [
            {"content": doc.page_content, "metadata": doc.metadata}
            for doc in docs
        ]
    }


@app.post("/api/chat")
async def chat(request: ChatRequest):
    session_id = request.session_id
    if not session_id:
        # Create a default session if none provided (or handle as transient)
        session_id = db.create_session("Transient Chat")
    
    # Save user message
    db.add_message(session_id, "user", request.message)

    async def event_generator():
        full_response = ""
        async for chunk in agent_service.chat_stream(request.message, mentions=request.mentions):
            full_response += chunk
            yield chunk
        
        # Save AI message after streaming is complete
        db.add_message(session_id, "ai", full_response)

    return StreamingResponse(event_generator(), media_type="text/plain; charset=utf-8")

# --- Knowledge Base APIs ---

@app.get("/api/knowledge_bases")
async def get_knowledge_bases():
    return db.get_knowledge_bases()

@app.post("/api/knowledge_bases")
async def create_knowledge_base(request: KBCreateRequest):
    kb_id = db.create_knowledge_base(request.name, request.description)
    return {"id": kb_id, "name": request.name, "description": request.description}

@app.delete("/api/knowledge_bases/{kb_id}")
async def delete_knowledge_base(kb_id: str):
    # 1. Delete docs from RAG (Chroma + BM25)
    rag_service.delete_kb_docs(kb_id)
    # 2. Delete metadata from DB
    db.delete_knowledge_base(kb_id)
    return {"status": "success", "message": "Knowledge base deleted"}

@app.get("/api/knowledge_bases/{kb_id}/chunks")
async def get_kb_chunks(kb_id: str):
    docs = rag_service.get_kb_chunks(kb_id)
    # Return list of text content
    return [doc if isinstance(doc, str) else doc.page_content for doc in docs]

@app.post("/api/knowledge_bases/{kb_id}/ingest")
async def ingest_kb_file(
    kb_id: str,
    file: UploadFile = File(...),
    chunk_size: int = Form(500),
    chunk_overlap: int = Form(50),
    split_method: str = Form("token"),
    preview_only: bool = Form(False)
):
    uploads_dir = os.path.join(os.path.dirname(__file__), "uploads")
    os.makedirs(uploads_dir, exist_ok=True)
    original_name = file.filename or "uploaded_file"
    _, ext = os.path.splitext(original_name)
    unique_name = f"{uuid4().hex}{ext}"
    save_path = os.path.join(uploads_dir, unique_name)
    try:
        with open(save_path, "wb") as buffer:
            shutil.copyfileobj(file.file, buffer)
    except Exception:
        raise HTTPException(status_code=500, detail="Failed to save uploaded file")
    
    absolute_path = os.path.abspath(save_path)
    
    try:
        docs = rag_service.ingest_file(
            absolute_path,
            chunk_size=chunk_size,
            chunk_overlap=chunk_overlap,
            split_method=split_method,
            kb_id=kb_id,
            preview_only=preview_only
        )
        return {
            "status": "success", 
            "filename": original_name,
            "preview_chunks": [doc.page_content for doc in docs] if docs else [],
            "chunk_count": len(docs)
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to process file: {str(e)}")

# --- Knowledge Graph APIs ---

@app.post("/api/knowledge_graph/generate")
async def generate_knowledge_graph(request: KGGenerateRequest):
    # Use real GraphService
    graph_data = graph_service.generate_graph(
        kb_ids=request.kb_ids,
        max_nodes=request.max_nodes or 50,
        granularity=request.granularity or "fine"
    )
    return graph_data


# --- Agent Workflow APIs ---

@app.get("/api/agents")
async def get_agents():
    return db.get_agents()

@app.post("/api/agents")
async def create_agent(request: AgentSaveRequest):
    # Create new agent
    result = db.save_agent(request.name, request.nodes, request.edges)
    return result

@app.put("/api/agents/{agent_id}")
async def update_agent(agent_id: str, request: AgentSaveRequest):
    # Update existing agent
    result = db.save_agent(request.name, request.nodes, request.edges, agent_id=agent_id)
    return result
