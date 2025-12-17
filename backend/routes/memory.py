from fastapi import APIRouter
from backend.utils.memory import clear_history

router = APIRouter()


@router.delete("/{conversation_id}")
def clear(conversation_id: str):
    clear_history(conversation_id)
    return {"status": "cleared"}
