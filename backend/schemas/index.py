from pydantic import BaseModel


class IndexResponse(BaseModel):
    indexed_chunks: int
