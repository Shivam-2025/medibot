'use client';

import React, { useState, useRef, useEffect } from 'react';
import ChatInput from '../components/ChatInput';
import SuggestedPrompts from '../components/SuggestedPrompts';
import { sendChatStream } from '../services/api'; // ✅ streaming
import { Message } from '../components/MessageList';
import Header from '../components/Header';
import MessageList from '../components/MessageList';

/** Local-only conversation model */
interface Conversation {
  id: string;
  title: string;
  messages: Message[];
  sources?: any[]; // optional array to store sources
}

const initialWelcomeMessage: Message = {
  id: '0',
  sender: 'bot',
  text:
    "Hello! I'm Medibot. I can provide general information on medical topics. Please remember, I am an AI assistant and not a medical professional. The information I provide is for educational purposes only and should not be considered medical advice. Always consult with a qualified healthcare provider for any health concerns.",
  timestamp: new Date().toISOString(),
};

const BotIcon = () => (
  <div className="w-8 h-8 rounded-md overflow-hidden flex-shrink-0">
    <img
      src="/public/bot.png"
      alt="bot"
      className="w-full h-full object-cover"
    />
  </div>
);

const LoadingIndicator = () => (
  <div className="flex items-start gap-3 md:gap-4 max-w-4xl mx-auto px-4 py-4 w-full">
    <BotIcon />
    <div className="p-3 flex items-center space-x-2 bg-slate-50 text-slate-600 dark:bg-slate-800 dark:text-slate-300 rounded-lg">
      <span className="w-2 h-2 bg-slate-400 dark:bg-slate-500 rounded-full animate-pulse" />
      <span
        className="w-2 htpbg-slate-400 dark:bg-slate-500 rounded-full animate-pulse"
        style={{ animationDelay: '0.2s' }}
      />
      <span
        className="w-2 h-2 bg-slate-400 dark:bg-slate-500 rounded-full animate-pulse"
        style={{ animationDelay: '0.4s' }}
      />
    </div>
  </div>
);

/** Sidebar (with delete + responsive toggle) */
function Sidebar({
  conversations,
  activeConversationId,
  onSelectConversation,
  onNewChat,
  onDeleteChat,
  isOpen,
  setIsOpen,
}: {
  conversations: Conversation[];
  activeConversationId: string | null;
  onSelectConversation: (id: string) => void;
  onNewChat: () => void;
  onDeleteChat: (id: string) => void;
  isOpen: boolean;
  setIsOpen: (open: boolean) => void;
}) {
  return (
    <>
      {isOpen && (
        <div
          className="fixed inset-0 bg-black/40 md:hidden z-20"
          onClick={() => setIsOpen(false)}
        />
      )}
      <aside
        className={`fixed md:relative top-0 left-0 h-full w-64 bg-white dark:bg-[#0b1220] border-r border-slate-200 dark:border-slate-800 flex flex-col z-30 transform ${
          isOpen ? 'translate-x-0' : '-translate-x-full'
        } md:translate-x-0 transition-transform duration-300`}
      >
        <div className="flex flex-col h-full">
          {/* New Chat Button */}
          <div className="p-3 border-b border-slate-200 dark:border-slate-800">
            <button
              onClick={onNewChat}
              className="flex items-center gap-2 w-full px-3 py-2 rounded-md bg-sky-600 text-white hover:bg-sky-700 transition-colors"
            >
              <span className="text-lg">＋</span>
              <span className="font-medium">New Chat</span>
            </button>
          </div>

          {/* Chat History */}
          <div className="flex-1 overflow-y-auto p-3 space-y-1">
            <h2 className="text-xs uppercase tracking-wide text-slate-500 dark:text-slate-400 px-1 mb-2">
              Chat History
            </h2>
            {conversations.length === 0 && (
              <p className="text-slate-500 text-sm px-2">No chats yet</p>
            )}
            {conversations.map((c) => (
              <div
                key={c.id}
                className={`flex items-center justify-between w-full px-3 py-2 rounded-md text-sm transition-colors cursor-pointer ${
                  activeConversationId === c.id
                    ? 'bg-slate-100 dark:bg-slate-800 text-sky-600 dark:text-sky-400'
                    : 'text-slate-700 dark:text-slate-300 hover:bg-slate-200/50 dark:hover:bg-slate-800/50'
                }`}
              >
                <div
                  onClick={() => onSelectConversation(c.id)}
                  className="flex-1 truncate"
                >
                  💬 {c.title}
                </div>
                <button
                  onClick={() => onDeleteChat(c.id)}
                  className="ml-2 text-slate-400 hover:text-red-500"
                >
                  ✕
                </button>
              </div>
            ))}
          </div>
        </div>
      </aside>
    </>
  );
}

export default function Home() {
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [activeConversationId, setActiveConversationId] = useState<string | null>(null);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [theme, setTheme] = useState<'light' | 'dark'>('dark');
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);

  const endRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (conversations.length === 0) {
      handleNewChat();
    }
  }, []); // eslint-disable-line

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [conversations, isLoading]);

  // ensures <html> gets dark class for global theming
  useEffect(() => {
    const root = document.documentElement;
    if (theme === 'dark') root.classList.add('dark');
    else root.classList.remove('dark');
  }, [theme]);

  const activeConversation = conversations.find((c) => c.id === activeConversationId);

  const handleSendMessage = async (file?: File | null, promptOverride?: string) => {
  const prompt = promptOverride ?? input;
  if (!prompt.trim() && !file) return;
  if (!activeConversationId) return;

  const fileUrl = file instanceof File ? URL.createObjectURL(file) : undefined;
  const userMsg: Message = {
    id: Date.now().toString(),
    sender: 'user',
    text: prompt,
    fileUrl,
    fileName: file?.name,
    fileType: file?.type,
    timestamp: new Date().toISOString(),
  };

  setConversations((prev) =>
    prev.map((c) =>
      c.id === activeConversationId
        ? { ...c, messages: [...c.messages, userMsg] }
        : c
    )
  );

  setInput('');
  setIsLoading(true);

  const botMsgId = (Date.now() + 1).toString();
  const botMsg: Message = {
    id: botMsgId,
    sender: 'bot',
    text: '',
    timestamp: new Date().toISOString(),
  };

  setConversations((prev) =>
    prev.map((c) =>
      c.id === activeConversationId
        ? { ...c, messages: [...c.messages, botMsg], sources: [] }
        : c
    )
  );

  try {
    // ✅ Accumulate text with proper formatting
    let accumulatedText = '';
    
await sendChatStream(
  activeConversationId,       // ✅ conversationId: string
  userMsg.text,               // ✅ message: string
  (chunk: string) => {        // ✅ onChunk callback
      // 🚫 ignore whitespace chunks (MOST IMPORTANT FIX)
  if (!chunk || chunk.trim() === "") return;
  
    accumulatedText += chunk;
    setIsLoading(false);
    setConversations((prev) =>
      prev.map((c) => {
        if (c.id !== activeConversationId) return c;
        return {
          ...c,
          messages: c.messages.map((m) =>
            m.id === botMsgId
              ? { ...m, text: accumulatedText }
              : m
          ),
        };
      })
    );
  },
  (sources) => {              // ✅ onSources callback (type is inferred)
    setConversations((prev) =>
      prev.map((c) =>
        c.id === activeConversationId
          ? { ...c, sources }
          : c
      )
    );
  }
);

  } catch (err: any) {
    console.error(err);

    let errorText = '⚠️ Something went wrong. Please try again.';

    if (err.message) {
      try {
        const match = err.message.match(/({.*})/);
        if (match) {
          const parsed = JSON.parse(match[1]);
          if (parsed.detail) {
            errorText = parsed.detail;
          }
        }
      } catch (e) {
        // ignore parsing errors
      }
    }

    const errorMsg: Message = {
      id: (Date.now() + 2).toString(),
      sender: 'bot',
      text: errorText,
      timestamp: new Date().toISOString(),
    };

    setConversations((prev) =>
      prev.map((c) =>
        c.id === activeConversationId
          ? { ...c, messages: [...c.messages, errorMsg] }
          : c
      )
    );
  } finally {
    setIsLoading(false);
  }
};

  const handleNewChat = () => {
    const newId = Date.now().toString();
    const newChat: Conversation = {
      id: newId,
      title: 'New Conversation',
      messages: [initialWelcomeMessage],
      sources: [],
    };
    setConversations((prev) => [newChat, ...prev]);
    setActiveConversationId(newId);
  };

  const handleDeleteChat = (id: string) => {
    setConversations((prev) => prev.filter((c) => c.id !== id));
    if (activeConversationId === id) {
      const remaining = conversations.filter((c) => c.id !== id);
      setActiveConversationId(remaining.length ? remaining[0].id : null);
    }
  };

  const handleSelectConversation = (id: string) => setActiveConversationId(id);

  const showWelcome = activeConversation?.messages.length === 1 && !isLoading;

  return (
    <div className="flex h-screen w-full font-sans antialiased bg-white text-slate-800 dark:bg-[#0b1220] dark:text-slate-100">
      {/* Sidebar */}
      <Sidebar
        conversations={conversations}
        activeConversationId={activeConversationId}
        onSelectConversation={handleSelectConversation}
        onNewChat={handleNewChat}
        onDeleteChat={handleDeleteChat}
        isOpen={isSidebarOpen}
        setIsOpen={setIsSidebarOpen}
      />

      {/* Main column */}
      <div className="flex flex-col flex-1 overflow-hidden">
        <Header
          theme={theme}
          onToggleTheme={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
          onToggleSidebar={() => setIsSidebarOpen(!isSidebarOpen)}
        />

        <main className="flex-1 overflow-y-auto flex flex-col">
          {showWelcome ? (
            <div className="flex-1 flex flex-col items-center justify-center px-4 text-center">
              <h2 className="text-3xl font-bold mb-3 text-slate-800 dark:text-white">
                New Conversation
              </h2>
              <p className="mb-6 text-slate-600 dark:text-slate-300 max-w-xl">
                Hello! I'm Medibot. I can provide general information on medical topics.
                This is educational and not medical advice. Always consult a clinician for care.
              </p>
              <div className="max-w-4xl w-full">
                <SuggestedPrompts
                  onSuggestionClick={(q) => handleSendMessage(undefined, q)}
                />
              </div>
            </div>
          ) : (
            <>
              <MessageList messages={activeConversation?.messages || []} />
              {isLoading && <LoadingIndicator />}
            </>
          )}
          <div ref={endRef} />
        </main>

        <ChatInput
          input={input}
          setInput={setInput}
          sendMessage={(file) => handleSendMessage(file)}
          isLoading={isLoading}
        />
      </div>
    </div>
  );
}
