'use client';

import React, { useState, useRef, useEffect } from 'react';
import { ChatMessage } from '@/lib/llm';
import { MarkdownMessage } from '@/components/MarkdownMessage';

export interface ChatSession {
  id: string;
  title: string;
  messages: ChatMessage[];
  updatedAt: number;
}

const STORAGE_KEY = 'customer_care_chat_sessions_v2';
const ACTIVE_SESSION_KEY = 'customer_care_active_session_id_v2';
const INITIAL_BOT_GREETING = "Hi, I'm Bot! How can I help you today? 😊";

function createNewSession(): ChatSession {
  return {
    id: 'chat_' + Date.now() + '_' + Math.random().toString(36).slice(2, 7),
    title: 'New Conversation',
    messages: [{ role: 'assistant', content: INITIAL_BOT_GREETING }],
    updatedAt: Date.now(),
  };
}

function formatSessionDate(timestamp: number): string {
  const date = new Date(timestamp);
  const now = new Date();
  const isToday =
    date.getDate() === now.getDate() &&
    date.getMonth() === now.getMonth() &&
    date.getFullYear() === now.getFullYear();

  if (isToday) {
    return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  }
  return date.toLocaleDateString([], { month: 'short', day: 'numeric' });
}

export default function CustomerCareChat() {
  const [sessions, setSessions] = useState<ChatSession[]>([]);
  const [currentSessionId, setCurrentSessionId] = useState<string>('');
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);
  const [isMounted, setIsMounted] = useState(false);

  const [input, setInput] = useState('');
  const [isStreaming, setIsStreaming] = useState(false);
  const [isThinking, setIsThinking] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const abortControllerRef = useRef<AbortController | null>(null);

  // Load chat sessions from localStorage on mount
  useEffect(() => {
    setIsMounted(true);
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      const savedActiveId = localStorage.getItem(ACTIVE_SESSION_KEY);

      if (saved) {
        const parsed: ChatSession[] = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length > 0) {
          setSessions(parsed);
          const activeExists = parsed.some((s) => s.id === savedActiveId);
          setCurrentSessionId(activeExists ? (savedActiveId as string) : parsed[0].id);
          return;
        }
      }
    } catch (e) {
      console.error('Failed to parse saved chat history:', e);
    }

    // Default: create initial session
    const initialSession = createNewSession();
    setSessions([initialSession]);
    setCurrentSessionId(initialSession.id);
    localStorage.setItem(STORAGE_KEY, JSON.stringify([initialSession]));
    localStorage.setItem(ACTIVE_SESSION_KEY, initialSession.id);
  }, []);

  // Save sessions to localStorage whenever sessions change
  const saveSessions = (updated: ChatSession[], activeId?: string) => {
    setSessions(updated);
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
      if (activeId) {
        localStorage.setItem(ACTIVE_SESSION_KEY, activeId);
      }
    } catch (e) {
      console.error('Failed to save chat sessions:', e);
    }
  };

  // Get active session
  const currentSession =
    sessions.find((s) => s.id === currentSessionId) || sessions[0] || null;
  const messages = currentSession?.messages || [];

  // Auto-scroll on new message chunks
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isThinking]);

  // Focus input
  useEffect(() => {
    textareaRef.current?.focus();
  }, [currentSessionId]);

  // Create a new chat session
  const handleNewChat = () => {
    if (isStreaming) {
      abortControllerRef.current?.abort();
      setIsStreaming(false);
      setIsThinking(false);
    }

    const newS = createNewSession();
    const updated = [newS, ...sessions];
    setCurrentSessionId(newS.id);
    saveSessions(updated, newS.id);
    setError(null);
    setInput('');
    setTimeout(() => textareaRef.current?.focus(), 50);
  };

  // Switch to another past chat
  const handleSelectSession = (sessionId: string) => {
    if (sessionId === currentSessionId) return;

    if (isStreaming) {
      abortControllerRef.current?.abort();
      setIsStreaming(false);
      setIsThinking(false);
    }

    setCurrentSessionId(sessionId);
    try {
      localStorage.setItem(ACTIVE_SESSION_KEY, sessionId);
    } catch {}
    setError(null);
    setInput('');
  };

  // Delete a specific session
  const handleDeleteSession = (e: React.MouseEvent, sessionId: string) => {
    e.stopPropagation();

    const remaining = sessions.filter((s) => s.id !== sessionId);
    if (remaining.length === 0) {
      const fresh = createNewSession();
      setCurrentSessionId(fresh.id);
      saveSessions([fresh], fresh.id);
    } else {
      let nextActiveId = currentSessionId;
      if (sessionId === currentSessionId) {
        nextActiveId = remaining[0].id;
        setCurrentSessionId(nextActiveId);
      }
      saveSessions(remaining, nextActiveId);
    }
  };

  // Clear all past chat history
  const handleClearAllHistory = () => {
    if (isStreaming) {
      abortControllerRef.current?.abort();
      setIsStreaming(false);
      setIsThinking(false);
    }

    const fresh = createNewSession();
    setCurrentSessionId(fresh.id);
    saveSessions([fresh], fresh.id);
    setError(null);
    setInput('');
  };

  const sendQuery = async (queryText: string) => {
    const trimmed = queryText.trim();
    if (!trimmed || isStreaming || !currentSession) return;

    setError(null);
    const userMessage: ChatMessage = { role: 'user', content: trimmed };
    const newHistory: ChatMessage[] = [...currentSession.messages, userMessage];

    // Determine session title from first user query
    let sessionTitle = currentSession.title;
    if (sessionTitle === 'New Conversation' || sessionTitle === 'Chat') {
      sessionTitle = trimmed.slice(0, 32) + (trimmed.length > 32 ? '...' : '');
    }

    // Optimistically update session in state and localStorage
    const optimisticMessages: ChatMessage[] = [
      ...newHistory,
      { role: 'assistant', content: '' },
    ];
    const updatedSessions = sessions.map((s) =>
      s.id === currentSession.id
        ? {
            ...s,
            title: sessionTitle,
            messages: optimisticMessages,
            updatedAt: Date.now(),
          }
        : s
    );
    saveSessions(updatedSessions, currentSession.id);

    setInput('');
    setIsStreaming(true);
    setIsThinking(true);

    const abortController = new AbortController();
    abortControllerRef.current = abortController;

    try {
      const response = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ messages: newHistory }),
        signal: abortController.signal,
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(
          errorData.error || `Server responded with status ${response.status}`
        );
      }

      if (!response.body) {
        throw new Error('Readable stream not supported or empty response body.');
      }

      const reader = response.body.getReader();
      const decoder = new TextDecoder('utf-8');
      let assistantResponse = '';

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        const chunk = decoder.decode(value, { stream: true });
        assistantResponse += chunk;

        if (assistantResponse && isThinking) {
          setIsThinking(false);
        }

        // Live stream update in active session
        setSessions((prev) =>
          prev.map((s) => {
            if (s.id !== currentSession.id) return s;
            const msgs = [...s.messages];
            msgs[msgs.length - 1] = {
              role: 'assistant',
              content: assistantResponse,
            };
            return { ...s, messages: msgs, updatedAt: Date.now() };
          })
        );
      }

      // Persist finalized response to localStorage
      setSessions((latest) => {
        try {
          localStorage.setItem(STORAGE_KEY, JSON.stringify(latest));
        } catch {}
        return latest;
      });
    } catch (err: unknown) {
      if (err instanceof Error && err.name === 'AbortError') {
        return;
      }
      const errMessage =
        err instanceof Error ? err.message : 'An unexpected error occurred.';
      setError(errMessage);

      // Rollback empty assistant placeholder if failed completely
      setSessions((prev) => {
        const rolledBack = prev.map((s) => {
          if (s.id !== currentSession.id) return s;
          const last = s.messages[s.messages.length - 1];
          if (last && last.role === 'assistant' && !last.content) {
            return { ...s, messages: s.messages.slice(0, -1) };
          }
          return s;
        });
        saveSessions(rolledBack, currentSession.id);
        return rolledBack;
      });
    } finally {
      setIsStreaming(false);
      setIsThinking(false);
      abortControllerRef.current = null;
      setTimeout(() => textareaRef.current?.focus(), 50);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendQuery(input);
    }
  };

  if (!isMounted) {
    return <div className="h-screen bg-white" />;
  }

  return (
    <div className="flex h-screen bg-white text-slate-800 overflow-hidden">
      {/* Sidebar Overlay on mobile */}
      {isSidebarOpen && (
        <div
          onClick={() => setIsSidebarOpen(false)}
          className="fixed inset-0 bg-slate-900/20 backdrop-blur-2xs z-20 md:hidden"
        />
      )}

      {/* Chat History Sidebar */}
      <aside
        className={`fixed md:static inset-y-0 left-0 z-30 w-72 bg-slate-50 border-r border-slate-200 flex flex-col transition-transform duration-300 ease-in-out shrink-0 ${
          isSidebarOpen ? 'translate-x-0' : '-translate-x-full md:-ml-72'
        }`}
      >
        {/* Sidebar Header */}
        <div className="p-4 border-b border-slate-200/80 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-lg bg-blue-600 text-white flex items-center justify-center text-xs font-bold shadow-2xs">
              💬
            </div>
            <h2 className="text-sm font-bold text-slate-900 tracking-tight">
              Chat History
            </h2>
          </div>
          <button
            onClick={() => setIsSidebarOpen(false)}
            className="p-1 rounded-md text-slate-400 hover:text-slate-600 hover:bg-slate-200/60 md:hidden"
          >
            ✕
          </button>
        </div>

        {/* New Chat Button */}
        <div className="p-3">
          <button
            onClick={handleNewChat}
            className="w-full flex items-center justify-center gap-2 py-2.5 px-4 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold shadow-xs transition active:scale-[0.98] cursor-pointer"
          >
            <span className="text-sm font-bold leading-none">+</span>
            <span>New Chat</span>
          </button>
        </div>

        {/* Sessions List */}
        <div className="flex-1 overflow-y-auto px-3 py-2 space-y-1">
          <div className="text-[10px] font-bold uppercase tracking-wider text-slate-400 px-2 py-1">
            Recent Conversations ({sessions.length})
          </div>

          {sessions.map((s) => {
            const isActive = s.id === currentSessionId;
            return (
              <div
                key={s.id}
                onClick={() => handleSelectSession(s.id)}
                className={`group relative flex items-center justify-between p-2.5 rounded-xl text-xs transition cursor-pointer border ${
                  isActive
                    ? 'bg-blue-50/90 border-blue-200 text-blue-900 font-semibold shadow-2xs'
                    : 'bg-transparent border-transparent hover:bg-slate-200/60 text-slate-700'
                }`}
              >
                <div className="flex items-center gap-2 min-w-0 pr-6">
                  <span className="text-slate-400 text-xs shrink-0">
                    {isActive ? '💬' : '🗨️'}
                  </span>
                  <div className="truncate">
                    <div className="truncate">{s.title}</div>
                    <div className="text-[10px] text-slate-400 font-normal">
                      {formatSessionDate(s.updatedAt)} • {s.messages.length} msg
                    </div>
                  </div>
                </div>

                {/* Delete Session Button */}
                <button
                  onClick={(e) => handleDeleteSession(e, s.id)}
                  title="Delete chat"
                  className="opacity-0 group-hover:opacity-100 p-1 text-slate-400 hover:text-rose-600 rounded transition absolute right-2"
                >
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    className="w-3.5 h-3.5"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
                    />
                  </svg>
                </button>
              </div>
            );
          })}
        </div>

        {/* Sidebar Footer */}
        <div className="p-3 border-t border-slate-200/80 bg-slate-50">
          <button
            onClick={handleClearAllHistory}
            className="w-full text-center text-[11px] text-slate-400 hover:text-rose-600 transition py-1 cursor-pointer"
          >
            Clear all chat history
          </button>
        </div>
      </aside>

      {/* Main Chat Area */}
      <div className="flex-1 flex flex-col h-screen min-w-0 bg-white">
        {/* Top Header */}
        <header className="flex items-center justify-between px-6 py-3.5 border-b border-slate-200/80 bg-white shrink-0">
          <div className="flex items-center gap-3">
            {/* Sidebar Toggle Button */}
            <button
              onClick={() => setIsSidebarOpen(!isSidebarOpen)}
              className="p-1.5 rounded-lg border border-slate-200 hover:bg-slate-100 text-slate-600 transition flex items-center justify-center cursor-pointer"
              title={isSidebarOpen ? 'Hide History' : 'Show History'}
            >
              <svg
                xmlns="http://www.w3.org/2000/svg"
                className="w-4 h-4"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
                strokeWidth={2}
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M4 6h16M4 12h16M4 18h16"
                />
              </svg>
            </button>

            {/* Blue Robot Avatar */}
            <div className="w-9 h-9 rounded-full bg-blue-600 flex items-center justify-center text-white shadow-2xs ring-2 ring-blue-100">
              <svg
                xmlns="http://www.w3.org/2000/svg"
                className="w-4 h-4"
                viewBox="0 0 24 24"
                fill="currentColor"
              >
                <path d="M12 2a2 2 0 0 1 2 2c0 .74-.4 1.39-1 1.73V7h1a7 7 0 0 1 7 7h1a1 1 0 0 1 1 1v3a1 1 0 0 1-1 1h-1v1a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-1H2a1 1 0 0 1-1-1v-3a1 1 0 0 1 1-1h1a7 7 0 0 1 7-7h1V5.73c-.6-.34-1-.99-1-1.73a2 2 0 0 1 2-2M7.5 13A1.5 1.5 0 0 0 6 14.5a1.5 1.5 0 0 0 1.5 1.5 1.5 1.5 0 0 0 1.5-1.5A1.5 1.5 0 0 0 7.5 13m9 0a1.5 1.5 0 0 0-1.5 1.5 1.5 1.5 0 0 0 1.5 1.5 1.5 1.5 0 0 0 1.5-1.5 1.5 1.5 0 0 0-1.5-1.5M12 17c-1.33 0-2.42.84-2.83 2h5.66c-.41-1.16-1.5-2-2.83-2" />
              </svg>
            </div>

            <div>
              <h1 className="text-sm font-bold text-slate-900 tracking-tight flex items-center gap-1.5">
                <span>{currentSession?.title || ' Bot'}</span>
                <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
              </h1>
              <p className="text-[11px] text-slate-500">
                Bot • Always active
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={handleNewChat}
              className="text-xs font-semibold text-blue-600 hover:text-blue-700 bg-blue-50 hover:bg-blue-100 border border-blue-200 px-3 py-1.5 rounded-full transition cursor-pointer flex items-center gap-1"
            >
              <span>+</span>
              <span>New Chat</span>
            </button>
          </div>
        </header>

        {/* Message Canvas */}
        <main className="flex-1 overflow-y-auto px-4 py-6 bg-white">
          <div className="max-w-2xl mx-auto space-y-5">
            {/* Session Started Banner */}
            <div className="text-center my-2">
              <span className="inline-block text-[11px] font-medium text-slate-400 bg-slate-50 border border-slate-200/60 rounded-full px-3 py-1">
                Connected with Bot
              </span>
            </div>

            {messages.map((msg, index) => {
              const isUser = msg.role === 'user';
              const isLatestAssistant =
                !isUser && isStreaming && index === messages.length - 1;

              return (
                <div
                  key={index}
                  className={`flex items-start gap-2.5 ${
                    isUser ? 'justify-end' : 'justify-start'
                  }`}
                >
                  {/* Bot Avatar */}
                  {!isUser && (
                    <div className="w-8 h-8 rounded-full bg-blue-600 flex items-center justify-center text-white shrink-0 mt-0.5 shadow-2xs">
                      <svg
                        xmlns="http://www.w3.org/2000/svg"
                        className="w-4 h-4"
                        viewBox="0 0 24 24"
                        fill="currentColor"
                      >
                        <path d="M12 2a2 2 0 0 1 2 2c0 .74-.4 1.39-1 1.73V7h1a7 7 0 0 1 7 7h1a1 1 0 0 1 1 1v3a1 1 0 0 1-1 1h-1v1a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-1H2a1 1 0 0 1-1-1v-3a1 1 0 0 1 1-1h1a7 7 0 0 1 7-7h1V5.73c-.6-.34-1-.99-1-1.73a2 2 0 0 1 2-2M7.5 13A1.5 1.5 0 0 0 6 14.5a1.5 1.5 0 0 0 1.5 1.5 1.5 1.5 0 0 0 1.5-1.5A1.5 1.5 0 0 0 7.5 13m9 0a1.5 1.5 0 0 0-1.5 1.5 1.5 1.5 0 0 0 1.5 1.5 1.5 1.5 0 0 0 1.5-1.5 1.5 1.5 0 0 0-1.5-1.5M12 17c-1.33 0-2.42.84-2.83 2h5.66c-.41-1.16-1.5-2-2.83-2" />
                      </svg>
                    </div>
                  )}

                  {/* Message Bubble */}
                  <div
                    className={`max-w-[85%] sm:max-w-[75%] px-4 py-3 rounded-2xl text-[14.5px] leading-relaxed shadow-2xs ${
                      isUser
                        ? 'bg-blue-600 text-white rounded-tr-xs whitespace-pre-wrap break-words'
                        : 'bg-[#EBF2FF] text-slate-800 border border-[#DBEAFE] rounded-tl-xs'
                    }`}
                  >
                    {isLatestAssistant && !msg.content ? (
                      /* Wave Bouncing Dots Loading Animation */
                      <div className="flex items-center space-x-1.5 py-1">
                        <span className="w-2 h-2 rounded-full bg-blue-600 loading-dot-1" />
                        <span className="w-2 h-2 rounded-full bg-indigo-600 loading-dot-2" />
                        <span className="w-2 h-2 rounded-full bg-purple-600 loading-dot-3" />
                        <span className="text-xs font-medium text-slate-500 ml-1.5 animate-pulse">
                          Typing...
                        </span>
                      </div>
                    ) : isUser ? (
                      <div>{msg.content}</div>
                    ) : (
                      <div className="relative">
                        <MarkdownMessage content={msg.content} />
                        {isLatestAssistant && (
                          <span className="inline-block w-1.5 h-4 ml-1 bg-blue-600 rounded-xs animate-pulse align-middle" />
                        )}
                      </div>
                    )}
                  </div>
                </div>
              );
            })}

            {/* Thinking / Processing State */}
            {isThinking && (
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-full bg-blue-600 flex items-center justify-center text-white shrink-0 shadow-2xs">
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    className="w-4 h-4"
                    viewBox="0 0 24 24"
                    fill="currentColor"
                  >
                    <path d="M12 2a2 2 0 0 1 2 2c0 .74-.4 1.39-1 1.73V7h1a7 7 0 0 1 7 7h1a1 1 0 0 1 1 1v3a1 1 0 0 1-1 1h-1v1a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-1H2a1 1 0 0 1-1-1v-3a1 1 0 0 1 1-1h1a7 7 0 0 1 7-7h1V5.73c-.6-.34-1-.99-1-1.73a2 2 0 0 1 2-2" />
                  </svg>
                </div>
                <div className="bg-[#EBF2FF] border border-[#DBEAFE] rounded-2xl rounded-tl-xs px-4 py-2.5 shadow-2xs flex items-center space-x-1.5">
                  <span className="w-2 h-2 rounded-full bg-blue-600 loading-dot-1" />
                  <span className="w-2 h-2 rounded-full bg-indigo-600 loading-dot-2" />
                  <span className="w-2 h-2 rounded-full bg-purple-600 loading-dot-3" />
                  <span className="text-xs font-medium text-slate-500 ml-1.5">
                    Thinking...
                  </span>
                </div>
              </div>
            )}

            {/* Error Banner */}
            {error && (
              <div className="p-3.5 text-xs text-rose-800 bg-rose-50 border border-rose-200 rounded-xl flex items-center gap-2">
                <span className="font-bold">Error:</span>
                <span>{error}</span>
              </div>
            )}

            <div ref={messagesEndRef} />
          </div>
        </main>

        {/* Message Input Box */}
        <footer className="p-4 border-t border-slate-200/80 bg-white shrink-0">
          <div className="max-w-2xl mx-auto">
            <form
              onSubmit={(e) => {
                e.preventDefault();
                sendQuery(input);
              }}
              className="flex items-center gap-2 bg-slate-50 border border-slate-300 rounded-full px-4 py-2 focus-within:border-blue-500 focus-within:ring-2 focus-within:ring-blue-100 transition"
            >
              <textarea
                ref={textareaRef}
                rows={1}
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="Type your message here..."
                disabled={isStreaming}
                className="flex-1 bg-transparent border-0 text-slate-900 placeholder-slate-400 text-sm focus:outline-none resize-none leading-relaxed py-1 max-h-24"
              />

              {input && (
                <button
                  type="button"
                  onClick={() => setInput('')}
                  className="text-xs text-slate-400 hover:text-slate-600 px-1 cursor-pointer"
                >
                  ✕
                </button>
              )}

              <button
                type="submit"
                disabled={!input.trim() || isStreaming}
                className="w-9 h-9 rounded-full bg-blue-600 hover:bg-blue-700 text-white flex items-center justify-center transition shadow-xs active:scale-95 disabled:opacity-40 disabled:hover:bg-blue-600 disabled:cursor-not-allowed shrink-0 cursor-pointer"
                title="Send message"
              >
                {isStreaming ? (
                  <div className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                ) : (
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    className="w-4 h-4 transform rotate-45 -mr-0.5 -mt-0.5"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                    strokeWidth={2.2}
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      d="M12 19V5m0 0l-7 7m7-7l7 7"
                    />
                  </svg>
                )}
              </button>
            </form>

            <p className="text-[11px] text-center text-slate-400 mt-2">
              Press <kbd className="px-1 py-0.5 rounded bg-slate-100 font-mono text-[10px]">Enter</kbd> to send, <kbd className="px-1 py-0.5 rounded bg-slate-100 font-mono text-[10px]">Shift+Enter</kbd> for newline
            </p>
          </div>
        </footer>
      </div>
    </div>
  );
}
