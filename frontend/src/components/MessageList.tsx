'use client';

import React from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';

export interface Message {
  id: string;
  text: string;
  sender: 'user' | 'bot';
  fileUrl?: string;
  fileName?: string;
  fileType?: string;
  timestamp?: string | number;
}

interface MessageListProps {
  messages: Message[];
}

const BotAvatar = () => (
  <img
    src="/public/bot.png"
    alt="Bot"
    className="w-8 h-8 rounded-md object-cover flex-shrink-0"
  />
);


const FileChip = ({ name, url }: { name: string; url?: string }) => (
  <a
    href={url}
    target="_blank"
    rel="noreferrer"
    className="inline-flex items-center gap-2 px-3 py-1 rounded-md bg-slate-100 text-slate-700 dark:bg-slate-700 dark:text-slate-100 border border-slate-200 dark:border-slate-600 text-xs hover:opacity-90"
    title={name}
  >
    📄 <span className="truncate max-w-[14rem]">{name}</span>
  </a>
);

// ⭐ NEW — Auto-fixes AI formatting mistakes before display
function enforceStructure(raw: string): string {
  if (!raw) return raw;

  let txt = raw;

  // 1️⃣ Remove empty standalone bullets
  txt = txt.replace(/^\s*[•\-*]\s*$/gm, "");

  // 2️⃣ Normalize double-star headings (any topic!)
  txt = txt.replace(/\*\*\s*(.*?)\s*\*\*/g, "**$1**");

  // 3️⃣ Ensure headings start on new lines
  txt = txt.replace(/([^\n])(\*\*[A-Za-z].*?\*\*)/g, "$1\n\n$2");

  // 4️⃣ Ensure headings are followed by a newline
  txt = txt.replace(/(\*\*[A-Za-z].*?\*\*)([^\n])/g, "$1\n$2");

  // ⭐ NEW RULE A — Ensure 2 blank lines between heading → heading
  txt = txt.replace(
    /(\*\*[^\*]+?\*\*)\n+(\*\*[^\*]+?\*\*)/g,
    "$1\n\n\n$2"
  );

  // ⭐ NEW RULE B — Ensure 2 blank lines after bullet block before next heading
  txt = txt.replace(
    /(\n\- [^\n]+(?:\n\- [^\n]+)*)\n+(\*\*[^\*]+?\*\*)/g,
    "$1\n\n\n$2"
  );

  // 5️⃣ Convert "Heading- Label:" into proper bullet lists
  // Example: "Type 1 Diabetes- Cause:" becomes:
  // **Type 1 Diabetes**
  // - **Cause:**
  txt = txt.replace(
    /([A-Za-z0-9\(\)\s]+)-\s*(Cause|Symptoms?|Management|Treatment|Summary)\s*:/gi,
    "**$1**\n- **$2:**"
  );

  // 6️⃣ Convert glued bullets into real markdown bullets:
  // ". - Text" → ".\n- Text"
  txt = txt.replace(/([a-z0-9])\.\s*-\s+/gi, "$1.\n- ");

  // 7️⃣ Fix bullets smashed together:
  txt = txt.replace(/-\s*(?=[A-Za-z])/g, "- ");

  // 8️⃣ Add missing newline before bullets: "Text- Something"
  txt = txt.replace(/([a-z])-\s+\*\*/gi, "$1\n- **");

  // 9️⃣ Fix medically broken words (safe general rules)
  txt = txt.replace(/\bur\s*ination\b/gi, "urination");
  txt = txt.replace(/\bauto\s*immune\b/gi, "autoimmune");
  txt = txt.replace(/\bun\s*int\s*ended\b/gi, "unintended");
  txt = txt.replace(/\bbl\s*urred\b/gi, "blurred");

  return txt.trim();
}


function safeDateFrom(ts?: string | number): Date | null {
  if (!ts) return null;
  if (typeof ts === 'number') {
    const d = new Date(ts);
    return Number.isNaN(d.getTime()) ? null : d;
  }
  const trimmed = ts.trim();
  if (/^-?\d+$/.test(trimmed)) {
    const num = Number(trimmed);
    const d = new Date(num);
    return Number.isNaN(d.getTime()) ? null : d;
  }
  const d = new Date(ts);
  return Number.isNaN(d.getTime()) ? null : d;
}

function fmtTime(d: Date) {
  return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

export default function MessageList({ messages }: MessageListProps) {
  return (
    <div className="max-w-4xl mx-auto w-full space-y-6 px-4 py-6">
      {messages.map((m) => {////this us 
        const isUser = m.sender === 'user';
        const isImage = m.fileUrl && (m.fileType?.startsWith('image/') ?? false);
        const d = safeDateFrom(m.timestamp);
        
        console.log("RAW TEXT >>>", JSON.stringify((m.text || '').slice(0, 300)));
        console.log("SANITIZED TEXT >>>", JSON.stringify((enforceStructure(m.text || '')).slice(0, 300)));

  // 🚫 FIX: Hide the first empty bot bubble during streaming
  if (m.sender === "bot" && (m.text || "").trim() === "") {
    return null;
  }


        return (
          <div
            key={m.id}
            className={`flex items-end gap-3 md:gap-4 ${isUser ? 'justify-end' : 'justify-start'} animate-fadeIn`}
          >
            {!isUser && <BotAvatar />}

            <div className="flex flex-col max-w-xl">
              <div
                className={`relative group px-4 py-3 text-sm leading-relaxed break-words rounded-xl shadow-md ${isUser
                  ? 'bg-sky-600 text-white rounded-tr-none self-end'
                  : 'bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-200 rounded-tl-none self-start'
                  }`}
              >
                {m.fileUrl && (
                  <div className="mb-2">
                    {isImage ? (
                      <img
                        src={m.fileUrl}
                        alt={m.fileName || 'attachment'}
                        className="rounded-md max-w-xs max-h-60 object-contain"
                      />
                    ) : (
                      <FileChip name={m.fileName || 'attachment'} url={m.fileUrl} />
                    )}
                  </div>
                )}

                {/* ⭐ Updated — now using sanitizer */}
                <ReactMarkdown
                  remarkPlugins={[remarkGfm]}
                  components={{
                    h1: ({ children }) => <h1 className="text-base font-bold mt-2 mb-1">{children}</h1>,
                    h2: ({ children }) => <h2 className="text-sm font-bold mt-2 mb-1">{children}</h2>,
                    h3: ({ children }) => <h3 className="text-sm font-semibold mt-2 mb-1">{children}</h3>,

                    p: ({ children }) => <p className="my-1 leading-snug">{children}</p>,

                    ul: ({ children }) => (
                      <ul className="ml-4 my-1 list-disc space-y-1">{children}</ul>
                    ),
                    li: ({ children }) => <li className="leading-snug">{children}</li>,
                  }}
                  className="prose dark:prose-invert max-w-none [&>*]:my-1"
                >
                  {enforceStructure(m.text || '')}
                </ReactMarkdown>

              </div>

              {d && (
                <span
                  className={`mt-1 text-xs text-slate-500 dark:text-slate-400 ${isUser ? 'text-right pr-1' : 'text-left pl-1'
                    }`}
                  title={d.toLocaleString()}
                >
                  {fmtTime(d)}
                </span>
              )}
            </div>

            {isUser && (
              <img
                src="/public/user.png"
                alt="User"
                className="w-8 h-8 rounded-md object-cover flex-shrink-0"
              />
            )}
          </div>
        );
      })}
    </div>
  );
}
