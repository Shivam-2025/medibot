from fastapi import Header, HTTPException, status
from backend.config import settings


def verify_api_key(
    x_api_key: str = Header(..., description="API access key for authentication")
) -> None:
    """
    Dependency function to verify the provided API key matches
    the server's configured key.

    Args:
        x_api_key (str): The API key provided in the request header.

    Raises:
        HTTPException: If the API key is missing or invalid.
    """

    # Check if server API key is configured
    if not settings.API_ACCESS_KEY:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Server API key is not configured",
        )

    # Validate provided API key
    if x_api_key != settings.API_ACCESS_KEY:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid API key",
        )
