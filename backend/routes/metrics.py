from fastapi import APIRouter
from backend.services.metrics import get_metrics

router = APIRouter()


@router.get("/")
def metrics():
    return get_metrics()
