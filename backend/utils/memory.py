import re
from collections import defaultdict, deque
from typing import List, Tuple

# Memory store:
# {
#   conversation_id: deque([("user", msg), ("assistant", msg)])
# }
# Stores last 3 conversation turns (6 messages total)
chat_memory = defaultdict(lambda: deque(maxlen=6))


def add_message(conversation_id: str, role: str, content: str) -> None:
    """
    Add a cleaned message to the conversation memory.

    Args:
        conversation_id (str): Unique conversation identifier.
        role (str): 'user' or 'assistant'.
        content (str): Message text.
    """
    chat_memory[conversation_id].append((role, content.strip()))


def get_history(conversation_id: str) -> List[Tuple[str, str]]:
    """
    Retrieve clean chat history for a conversation.

    Args:
        conversation_id (str): Unique conversation identifier.

    Returns:
        List[Tuple[str, str]]: List of (role, message) pairs.
    """
    return list(chat_memory[conversation_id])


def clear_history(conversation_id: str) -> None:
    """
    Clear chat history for a conversation.

    Args:
        conversation_id (str): Unique conversation identifier.
    """
    chat_memory[conversation_id].clear()
