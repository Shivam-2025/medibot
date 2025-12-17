import re
from langchain_community.document_loaders import PyPDFLoader, DirectoryLoader
from langchain.text_splitter import RecursiveCharacterTextSplitter
from langchain.schema import Document
from typing import List



def clean_spacing(text: str) -> str:
    # Remove broken hyphen splits (PDF line breaks)
    text = re.sub(r'-\n', '', text)

    # Remove random spaces inside words (main issue)
    text = re.sub(r'(?<=\w)\s+(?=\w)', '', text)

    # Normalize spacing
    text = re.sub(r'\s+', ' ', text)

    return text.strip()

def load_pdf_folder(path: str):
    loader = DirectoryLoader(path, glob="*.pdf", loader_cls=PyPDFLoader)
    docs = loader.load()

    # ✅ Apply cleaning to every extracted page
    for d in docs:
        d.page_content = clean_spacing(d.page_content)

    return docs

def split_documents(
    documents: List[Document],
    chunk_size: int = 1000,
    chunk_overlap: int = 200
) -> List[Document]:
    """
    Split documents into smaller overlapping chunks for embeddings.
    """

    splitter = RecursiveCharacterTextSplitter(
        chunk_size=chunk_size,
        chunk_overlap=chunk_overlap
    )

    return splitter.split_documents(documents)