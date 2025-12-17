// services/api.ts

export interface ChatRequest {
  message: string;
  conversation_id?: string;
}

export interface ChatResponse {
  answer: string; // ✅ instead of "content"
  sources: { title?: string; page?: number; snippet?: string }[];
}

const BASE_URL = "http://localhost:8000"; // 🔗 FastAPI server
const API_KEY = "supersecretkey123";
async function handleResponse(res: Response) {
  if (!res.ok) {
    const errText = await res.text();
    throw new Error(`Request failed: ${res.status} - ${errText}`);
  }
  return res.json();
}

/** Send chat message (non-streaming) */
export async function sendChat(req: ChatRequest): Promise<ChatResponse> {
  const res = await fetch(`${BASE_URL}/chat`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": API_KEY,
    },
    body: JSON.stringify(req),
  });
  return handleResponse(res);
}

/** Send chat message as a stream (SSE) */
export async function sendChatStream(
  conversationId: string,  // ✅ More explicit
  message: string,         // ✅ More explicit
  onChunk: (chunk: string) => void,
  onSources?: (sources: Array<{
    title?: string;
    page?: number;
    paragraph?: string;
    url?: string;
  }>) => void
): Promise<void> {
  const req: ChatRequest = {
    message,
    conversation_id: conversationId,
  };

  const res = await fetch(`${BASE_URL}/api/chat?stream=true`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": API_KEY,
    },
    body: JSON.stringify(req),
  });

  if (!res.ok) {
    const errText = await res.text();
    throw new Error(`Stream request failed: ${res.status} - ${errText}`);
  }

  const reader = res.body?.getReader();
  const decoder = new TextDecoder("utf-8");
  let buffer = "";

  if (!reader) {
    throw new Error('Response body is not readable');
  }

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;

    // Decode incremental chunks
    buffer += decoder.decode(value, { stream: true });

    // Split Server-Sent Event messages
    const lines = buffer.split("\n\n");
    buffer = lines.pop() || "";

    for (const line of lines) {
      if (!line.trim() || !line.startsWith('data: ')) continue;

      const data = line.slice(6); // Remove 'data: ' prefix
      
      if (data === '[DONE]') continue;

      try {
        const parsed = JSON.parse(data);
        
        if (parsed.type === 'sources' && onSources) {
          onSources(parsed.data);
        } else if (typeof parsed === 'string') {
          onChunk(parsed);
        } else {
          onChunk(data);
        }
      } catch {
        // If not JSON, treat as plain text
        onChunk(data);
      }
    }
  }
}



/** Upload one PDF */
export async function uploadPdf(file: File): Promise<{ message: string }> {
  const formData = new FormData();
  formData.append("file", file); // ✅ single file

  const res = await fetch(`${BASE_URL}/upload_pdf`, {
    method: "POST",
    body: formData,
  });
  return handleResponse(res);
}

/** Start a new conversation */
export async function startNewChat(): Promise<{ conversation_id: string }> {
  const res = await fetch(`${BASE_URL}/new_chat`, {
    method: "POST",
  });
  return handleResponse(res);
}
