'use client';

import React, { useRef, useState } from 'react';

interface ChatInputProps {
  input: string;
  setInput: (input: string) => void;
  sendMessage: (file?: File | null) => void;
  isLoading: boolean;
}

export default function ChatInput({
  input,
  setInput,
  sendMessage,
  isLoading,
}: ChatInputProps) {
  const textAreaRef = useRef<HTMLTextAreaElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [attachedFile, setAttachedFile] = useState<File | null>(null);

  const onKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey && !isLoading && (input.trim() || attachedFile)) {
      e.preventDefault();
      sendMessage(attachedFile ?? undefined);
      setAttachedFile(null);
    }
  };

  const adjustHeight = () => {
    if (textAreaRef.current) {
      textAreaRef.current.style.height = 'auto';
      textAreaRef.current.style.height = `${textAreaRef.current.scrollHeight}px`;
    }
  };

  React.useEffect(() => {
    adjustHeight();
  }, [input]);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      setAttachedFile(e.target.files[0]);
    }
  };

  return (
    <div className="bg-white dark:bg-[#0b1220] w-full border-t border-slate-200 dark:border-slate-800">
      <div className="max-w-4xl mx-auto w-full p-4">
        <div className="relative flex items-end gap-3 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 shadow-sm p-2">
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            className="p-2 -ml-1 text-slate-500 dark:text-slate-300 hover:text-sky-600 dark:hover:text-sky-400 transition-colors"
            title="Attach file"
          >
            📎
          </button>
          <input
            type="file"
            ref={fileInputRef}
            className="hidden"
            onChange={handleFileChange}
          />

          <textarea
            ref={textAreaRef}
            rows={1}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={onKeyDown}
            disabled={isLoading}
            placeholder="Ask Medibot a question…"
            className="flex-1 w-full bg-transparent text-slate-800 dark:text-slate-100 placeholder-slate-400 dark:placeholder-slate-500 focus:outline-none resize-none max-h-48 py-2"
          />

          <button
            type="button"
            onClick={() => {
              sendMessage(attachedFile ?? undefined);
              setAttachedFile(null);
            }}
            disabled={isLoading || (!input.trim() && !attachedFile)}
            className="px-4 py-2 bg-sky-600 text-white rounded-lg disabled:opacity-50 hover:bg-sky-700"
          >
            Send
          </button>
        </div>

        {attachedFile && (
          <div className="mt-2 text-sm text-slate-600 dark:text-slate-300 flex items-center gap-2">
            <span>📂 Attached:</span>
            <span className="font-medium">{attachedFile.name}</span>
            <button
              onClick={() => setAttachedFile(null)}
              className="ml-2 text-sky-600 dark:text-sky-400 hover:underline"
            >
              remove
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
