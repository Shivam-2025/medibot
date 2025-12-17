from fastapi import FastAPI, UploadFile, File
from fastapi.middleware.cors import CORSMiddleware
from typing import List

from backend.routes import chat, index, memory, metrics
from backend.routes.chat import chat_handler
from backend.routes.index import upload_pdf_handler
from backend.schemas.chat import ChatRequest

import uuid

# Create FastAPI app instance
app = FastAPI(
    title="Medical Chatbot API",
    version="1.0.0",
    description="API for a RAG-powered medical chatbot with indexing, memory, and chat endpoints."
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:5173",
        "http://127.0.0.1:5173",
        "http://localhost:8000",
        "http://127.0.0.1:8000",
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ✅ Modular routes
app.include_router(chat.router, prefix="/api/chat", tags=["Chat"])
app.include_router(index.router, prefix="/api/index", tags=["Indexing"])
app.include_router(memory.router, prefix="/api/memory", tags=["Memory"])
app.include_router(metrics.router, prefix="/metrics", tags=["Metrics"])


@app.get("/api/health")
def health_check():
    return {"status": "ok", "message": "Medical Chatbot API is running"}


# -------------------------
# ✅ Top-level endpoints for frontend
# -------------------------

@app.post("/new_chat")
def new_chat():
    """Start a new chat session."""
    conversation_id = str(uuid.uuid4())
    return {"conversation_id": conversation_id}


@app.post("/chat")
async def chat_with_bot(request: ChatRequest):
    if not request.conversation_id:
        request.conversation_id = str(uuid.uuid4())

    resp = await chat_handler(request)

    return {
        "answer": resp.answer,
+       "sources": resp.sources,
        "conversation_id": request.conversation_id
    }


@app.post("/upload_pdf")
async def upload_pdf(file: UploadFile = File(...)):
    await upload_pdf_handler(file)

    return {
        "message": "PDF uploaded and indexed successfully"
    }

