import time

_METRICS = {
    "queries": 0,
    "total_latency_ms": 0.0,
}


def log_query(latency_ms: float) -> None:
    _METRICS["queries"] += 1
    _METRICS["total_latency_ms"] += latency_ms


def get_metrics():
    avg = (
        _METRICS["total_latency_ms"] / _METRICS["queries"]
        if _METRICS["queries"] > 0
        else 0
    )

    return {
        "total_queries": _METRICS["queries"],
        "avg_latency_ms": round(avg, 2),
    }
