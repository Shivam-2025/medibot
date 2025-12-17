from fastapi import HTTPException, status


FORBIDDEN_KEYWORDS = [
    "diagnose me",
    "prescribe",
    "dosage",
    "how much medicine",
    "treat me",
]


def safety_check(message: str) -> None:
    lower = message.lower()

    for k in FORBIDDEN_KEYWORDS:
        if k in lower:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="⚠️ I can provide medical information, not diagnosis or treatment."
            )
