from fastapi import APIRouter, UploadFile, File
import tempfile
import os

from backend.services.retriever import index_documents
from backend.schemas.index import IndexResponse

router = APIRouter()


@router.post("/upload", response_model=IndexResponse)
async def upload_pdf_handler(file: UploadFile = File(...)):
    with tempfile.TemporaryDirectory() as tmp:
        path = os.path.join(tmp, file.filename)

        with open(path, "wb") as f:
            f.write(await file.read())

        count = await index_documents(tmp)

    return IndexResponse(indexed_chunks=count)
