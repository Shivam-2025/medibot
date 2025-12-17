from typing import AsyncGenerator, Tuple, List, Dict
import os
import asyncio
import json
import re

from langchain_openai import ChatOpenAI
from langchain.chains import create_retrieval_chain
from langchain.chains.combine_documents import create_stuff_documents_chain
from langchain_core.prompts import ChatPromptTemplate
from langchain.callbacks.streaming_aiter import AsyncIteratorCallbackHandler

from backend.prompts.base_prompt import system_prompt
from backend.services.retriever import get_retriever
from backend.config import settings
from backend.utils.memory import get_history, add_message
from backend.utils.formatting import clean_spacing


def build_conversation_context(conversation_id: str) -> str:
    history = get_history(conversation_id)
    return "".join(
        f"{'User' if role == 'user' else 'Assistant'}: {content}\n"
        for role, content in history
    )


def looks_like_markdown(text: str) -> bool:
    if re.search(r"\*\*[^\\n]+\*\*", text):
        return True
    if re.search(r"^\s*-\s+", text, flags=re.MULTILINE):
        return True
    return False


async def ensure_markdown(text: str, llm: ChatOpenAI) -> str:
    if looks_like_markdown(text):
        return text

    reform_prompt = f"""
Reformat the following text into the required Markdown structure:
**Main Topic**
- One-line intro
**Key Points**
- ...
**Details**
- ...
**Summary**
- ...

ONLY return the properly formatted Markdown.
Do not add anything new.

ORIGINAL_REPLY:
{text}
"""

    resp = llm.invoke([("human", reform_prompt)])
    return resp.content.strip()


def is_bad_answer(text: str) -> bool:
    if not text or len(text.strip()) < 12:
        return True

    space_ratio = text.count(" ") / max(len(text), 1)
    if space_ratio < 0.05:
        return True

    bad_keywords = [
        "i don't know",
        "idontknow",
        "unknown",
        "no answer",
        "cannot answer",
        "not found",
    ]

    return any(b in text.lower() for b in bad_keywords)


async def get_llm_response(conversation_id: str, user_message: str) -> Tuple[str, List[Dict]]:
    retriever = get_retriever()

    llm = ChatOpenAI(
        temperature=0.4,
        model="gpt-4o",
        openai_api_key=settings.OPENAI_API_KEY
    )

    conversation_context = build_conversation_context(conversation_id)

    # 🔍 MEDICAL-ONLY CLASSIFIER (non-streaming version)
    classifier_prompt = f"""
    Is the following question medical-related (health, disease, physiology,
    diagnosis, pathology, treatment)? Reply 'yes' or 'no' only.

    Question: "{user_message}"
    """

    classifier_llm = ChatOpenAI(
        temperature=0,
        model="gpt-4o",
        openai_api_key=settings.OPENAI_API_KEY
    )

    is_medical = classifier_llm.invoke([("human", classifier_prompt)]).content.strip().lower()

    if "no" in is_medical:
        answer = "⚠️ I can only answer medical and health-related questions."
        add_message(conversation_id, "assistant", answer)
        return answer, []

    # Continue as normal...
    prompt = ChatPromptTemplate.from_messages([
        ("system", system_prompt),
        ("human", f"{conversation_context}{{input}}")
    ])

    qa_chain = create_stuff_documents_chain(llm, prompt)
    rag_chain = create_retrieval_chain(retriever, qa_chain)

    response = rag_chain.invoke({"input": user_message})
    context_docs = response.get("context", [])

    answer = clean_spacing(str(response.get("answer", "")).strip())

    if not context_docs:
        fallback_msg = llm.invoke([
            ("system", "You are a highly knowledgeable medical tutor. Explain clearly in structured bullets."),
            ("human", user_message)
        ])
        answer = clean_spacing(fallback_msg.content.strip())

    if is_bad_answer(answer):
        fallback_msg = llm.invoke([
            ("system", "You are a highly knowledgeable medical tutor. Answer with clear bullet points."),
            ("human", user_message)
        ])
        answer = clean_spacing(fallback_msg.content.strip())

    add_message(conversation_id, "user", user_message)
    add_message(conversation_id, "assistant", answer)

    # Extract sources
    seen = set()
    sources = []
    for doc in context_docs:
        if not hasattr(doc, "metadata"):
            continue
        title = doc.metadata.get("source", "Unknown Source")
        page = doc.metadata.get("page", "N/A")

        key = (title, page)
        if key in seen:
            continue
        seen.add(key)

        paragraph = (getattr(doc, "page_content", "") or "").strip()
        file_url = title if isinstance(title, str) and title.startswith("http") else f"/files/{os.path.basename(str(title))}"

        sources.append({
            "title": title,
            "page": page,
            "paragraph": paragraph,
            "url": file_url
        })

    if not sources:
        answer += "\n\n_(This explanation is based on general medical knowledge.)_"

    answer = await ensure_markdown(answer, llm)

    return answer, sources



async def stream_llm_response(
    conversation_id: str,
    user_message: str,
) -> AsyncGenerator[str, None]:

    retriever = get_retriever()
    callback = AsyncIteratorCallbackHandler()

    llm = ChatOpenAI(
        temperature=0.4,
        model="gpt-4o",
        streaming=True,
        callbacks=[callback],
        openai_api_key=settings.OPENAI_API_KEY,
    )

    conversation_context = build_conversation_context(conversation_id)

     # 🔍 MEDICAL-ONLY CLASSIFIER (STREAMING version)
    classifier_llm = ChatOpenAI(
        temperature=0,
        model="gpt-4o",
        openai_api_key=settings.OPENAI_API_KEY
    )

    classifier_prompt = f"""
    Is the following question medical-related (health, disease, physiology,
    diagnosis, pathology, treatment)? Reply 'yes' or 'no' only.

    Question: "{user_message}"
    """

    is_medical = classifier_llm.invoke([("human", classifier_prompt)]).content.strip().lower()

    if "no" in is_medical:
        yield "⚠️ I can only answer medical and health-related questions."
        add_message(conversation_id, "assistant", "⚠️ I can only answer medical questions.")
        return


    prompt = ChatPromptTemplate.from_messages([
        ("system", system_prompt),
        ("human", f"{conversation_context}{{input}}"),
    ])

    qa_chain = create_stuff_documents_chain(llm, prompt)
    rag_chain = create_retrieval_chain(retriever, qa_chain)

    add_message(conversation_id, "user", user_message)

    response_holder: Dict[str, Dict] = {}

    async def run_chain():
        try:
            resp = await rag_chain.ainvoke({"input": user_message})
            response_holder["resp"] = resp
        except Exception as e:
            print("⚠️ Streaming chain error:", e)
        finally:
            if hasattr(callback, "aiter_queue"):
                await callback.aiter_queue.put(None)
            elif hasattr(callback, "done") and hasattr(callback.done, "set"):
                callback.done.set()

    asyncio.create_task(run_chain())

    full_text = ""

    async for token in callback.aiter():
        text = str(token)
        if isinstance(text, str):
            full_text += text
        yield text

    full_text = clean_spacing(full_text.strip())
    full_text = await ensure_markdown(full_text, llm)

    add_message(conversation_id, "assistant", full_text)

    sources: List[Dict] = []

    try:
        resp = response_holder.get("resp", {}) or {}
        context_docs = resp.get("context", [])

        seen = set()

        for doc in context_docs:
            if not hasattr(doc, "metadata"):
                continue

            title = doc.metadata.get("source", "Unknown Source")
            page = doc.metadata.get("page", "N/A")
            key = (title, page)

            if key in seen:
                continue

            seen.add(key)

            paragraph = (getattr(doc, "page_content", "") or "").strip()

            file_url = (
                title
                if isinstance(title, str) and title.startswith("http")
                else f"/files/{os.path.basename(str(title))}"
            )

            sources.append({
                "title": title,
                "page": page,
                "paragraph": paragraph,
                "url": file_url,
            })

    except Exception:
        sources = []

    yield json.dumps({"type": "sources", "data": sources})
