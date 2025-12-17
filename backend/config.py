from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    OPENAI_API_KEY: str
    PINECONE_API_KEY: str
    INDEX_NAME: str = "medical-rag-index"
    API_ACCESS_KEY: str | None = None

    class Config:
        env_file = ".env"


settings = Settings()
