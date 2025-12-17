from __future__ import annotations
from typing import List
import os

from langchain_openai import OpenAIEmbeddings
from langchain_community.vectorstores import FAISS
from langchain.schema import Document
from langchain_huggingface import HuggingFaceEmbeddings
from backend.config import settings


# Directory where FAISS index is stored
INDEX_DIR = os.path.join("backend", "data", "faiss_index")


def get_embeddings() -> OpenAIEmbeddings:
    """
    Initialize OpenAI embeddings.
    """
    return OpenAIEmbeddings(
        openai_api_key=settings.OPENAI_API_KEY
    )


def load_faiss_index() -> FAISS | None:
    """
    Load existing FAISS index if it exists.
    """
    if os.path.exists(INDEX_DIR):
        embeddings = get_embeddings()
        return FAISS.load_local(
            INDEX_DIR,
            embeddings,
            allow_dangerous_deserialization=True
        )
    return None


def save_faiss_index(vectorstore: FAISS) -> None:
    """
    Save FAISS index to disk.
    """
    os.makedirs(INDEX_DIR, exist_ok=True)
    vectorstore.save_local(INDEX_DIR)


def create_or_update_faiss(docs: List[Document]) -> FAISS:
    """
    Create a new FAISS index or update the existing one.
    """
    embeddings = get_embeddings()
    existing_index = load_faiss_index()

    if existing_index:
        existing_index.add_documents(docs)
        vectorstore = existing_index
    else:
        vectorstore = FAISS.from_documents(docs, embeddings)

    save_faiss_index(vectorstore)
    return vectorstore

def get_hf_embeddings() -> "HuggingFaceEmbeddings":
    return HuggingFaceEmbeddings(
        model_name="sentence-transformers/all-MiniLM-L6-v2"
    )
