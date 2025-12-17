from __future__ import annotations

import os
import json
import hashlib
from typing import List, Tuple, Dict

from backend.services.embeddings import get_hf_embeddings
from backend.utils.pdf_loader import load_pdf_folder, split_documents
from backend.config import settings

from langchain_community.vectorstores import FAISS
from backend.services.embeddings import get_hf_embeddings
from backend.utils.pdf_loader import load_pdf_folder, split_documents
from backend.config import settings

_vectorstore = None  # cache
# -------------------
# Local manifest for incremental indexing
# -------------------

_MANIFEST_DIR = os.path.join("storage")
_MANIFEST_PATH = os.path.join(_MANIFEST_DIR, "index_manifest.json")


# -------------------
# Manifest Helpers
# -------------------

def _ensure_manifest_store() -> None:
    """Ensure the manifest file exists."""
    os.makedirs(_MANIFEST_DIR, exist_ok=True)

    if not os.path.exists(_MANIFEST_PATH):
        with open(_MANIFEST_PATH, "w", encoding="utf-8") as f:
            json.dump({"chunks": {}}, f)


def _load_manifest() -> Dict[str, Dict]:
    _ensure_manifest_store()
    with open(_MANIFEST_PATH, "r", encoding="utf-8") as f:
        return json.load(f)


def _save_manifest(manifest: Dict[str, Dict]) -> None:
    _ensure_manifest_store()
    with open(_MANIFEST_PATH, "w", encoding="utf-8") as f:
        json.dump(manifest, f, ensure_ascii=False, indent=2)


# -------------------
# Hash & ID Generation
# -------------------

def _sha256(text: str) -> str:
    return hashlib.sha256(text.encode("utf-8")).hexdigest()


def _chunk_id(
    source: str,
    page: str | int,
    chunk_idx: int,
    content_hash: str
) -> str:
    """
    Build a deterministic Pinecone vector ID for a chunk.
    """
    safe_source = os.path.normpath(str(source))
    key = f"{safe_source}::page={page}::chunk={chunk_idx}::h={content_hash[:16]}"
    return hashlib.sha1(key.encode("utf-8")).hexdigest()  # short, URL-safe ID


# -------------------
# Incremental Indexing Helpers
# -------------------

def _prepare_incremental_batches(chunks) -> Tuple[List, List[str]]:
    """
    Return only the NEW/CHANGED chunks with their IDs,
    skipping ones already in the manifest.
    """
    manifest = _load_manifest()
    known = manifest.get("chunks", {})

    new_docs = []
    new_ids = []

    for idx, doc in enumerate(chunks):
        meta = getattr(doc, "metadata", {}) or {}
        source = meta.get("source", "unknown")
        page = meta.get("page", "N/A")

        content = (getattr(doc, "page_content", "") or "").strip()
        h = _sha256(content)

        cid = _chunk_id(source, page, idx, h)

        if cid in known:
            continue

        new_docs.append(doc)
        new_ids.append(cid)

    return new_docs, new_ids


def _update_manifest(chunks, ids: List[str]) -> None:
    """Update manifest after successful indexing."""
    if not ids:
        return

    manifest = _load_manifest()
    known = manifest.setdefault("chunks", {})

    for doc, cid in zip(chunks, ids):
        meta = getattr(doc, "metadata", {}) or {}
        source = meta.get("source", "unknown")
        page = meta.get("page", "N/A")

        content = (getattr(doc, "page_content", "") or "").strip()

        known[cid] = {
            "source": source,
            "page": page,
            "hash": _sha256(content),
        }

    _save_manifest(manifest)


# -------------------
# Pinecone Batching Helpers
# -------------------

def _batch_upsert(vs, documents, ids, batch_size: int = 1000):
    """Upsert in batches to avoid Pinecone's 1000-item limit."""
    for i in range(0, len(documents), batch_size):
        vs.add_documents(
            documents=documents[i:i + batch_size],
            ids=ids[i:i + batch_size]
        )


def _batch_delete(index, ids, batch_size: int = 1000):
    """Delete in batches to avoid Pinecone's 1000-item limit."""
    for i in range(0, len(ids), batch_size):
        index.delete(ids=ids[i:i + batch_size])


# -------------------
# Main Indexing Function
# -------------------

async def index_documents(folder_path: str) -> int:
    """
    Incremental indexing:
    - Load PDFs
    - Split into chunks
    - Skip already indexed chunks
    - Embed & upsert only new ones

    Returns:
        int: Number of chunks actually indexed
    """
    # 1) Load & split
    docs = load_pdf_folder(folder_path)
    chunks = split_documents(docs)

    # 2) Filter new / changed chunks
    new_docs, new_ids = _prepare_incremental_batches(chunks)
    if not new_docs:
        return 0

    # 3) Ensure Pinecone index exists
    pc = Pinecone(api_key=settings.PINECONE_API_KEY)
    existing = [idx.name for idx in pc.list_indexes()]

    if settings.INDEX_NAME not in existing:
        pc.create_index(
            name=settings.INDEX_NAME,
            dimension=384,
            metric="cosine",
            spec=ServerlessSpec(cloud="aws", region="us-east-1"),
        )

    # 4) Upsert to Pinecone
    embeddings = get_hf_embeddings()
    vs = PineconeVectorStore.from_existing_index(
        index_name=settings.INDEX_NAME,
        embedding=embeddings,
    )

    _batch_upsert(vs, new_docs, new_ids, batch_size=1000)

    # 5) Update manifest
    _update_manifest(new_docs, new_ids)

    return len(new_docs)


# -------------------
# Document Listing & Deletion
# -------------------

def list_indexed_docs() -> List[Dict]:
    """
    List all indexed documents grouped by source.
    """
    manifest = _load_manifest()
    chunks = manifest.get("chunks", {})

    docs_summary: Dict[str, Dict] = {}

    for cid, meta in chunks.items():
        source = meta.get("source", "unknown")
        page = meta.get("page", "N/A")

        if source not in docs_summary:
            docs_summary[source] = {
                "source": source,
                "total_chunks": 0,
                "pages": set(),
            }

        docs_summary[source]["total_chunks"] += 1
        docs_summary[source]["pages"].add(page)

    return [
        {
            "source": v["source"],
            "total_chunks": v["total_chunks"],
            "pages": sorted(list(v["pages"])),
        }
        for v in docs_summary.values()
    ]


def delete_document(source: str) -> Dict:
    """
    Delete all chunks for a given source from Pinecone and manifest.
    """
    manifest = _load_manifest()
    chunks = manifest.get("chunks", {})

    ids_to_delete = [
        cid for cid, meta in chunks.items()
        if meta.get("source") == source
    ]

    if not ids_to_delete:
        return {
            "deleted_chunks": 0,
            "message": f"No document found with source '{source}'"
        }

    # Delete from Pinecone
    pc = Pinecone(api_key=settings.PINECONE_API_KEY)
    index = pc.Index(settings.INDEX_NAME)

    _batch_delete(index, ids_to_delete, batch_size=1000)

    # Remove from manifest
    for cid in ids_to_delete:
        chunks.pop(cid, None)

    _save_manifest(manifest)

    return {
        "deleted_chunks": len(ids_to_delete),
        "source": source,
        "message": "Document deleted successfully",
    }


# -------------------
# Retriever Builder
# -------------------


def get_retriever():
    """
    Return a FAISS-based retriever built from local PDFs.
    """
    global _vectorstore

    if _vectorstore is None:
        embeddings = get_hf_embeddings()

        # 1. Load PDFs
        documents = load_pdf_folder(settings.PDF_DIR)

        # 2. Split documents
        splits = split_documents(documents)

        # 3. Build FAISS index
        _vectorstore = FAISS.from_documents(
            splits,
            embedding=embeddings,
        )

    return _vectorstore.as_retriever(
        search_type="similarity",
        search_kwargs={"k": 3},
    )

