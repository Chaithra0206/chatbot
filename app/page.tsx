'use client';

import React, { useState, useRef, useEffect } from 'react';
import { ChatMessage } from '@/lib/llm';

export default function ChatPage() {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState('');
  const [isStreaming, setIsStreaming] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const abortControllerRef = useRef<AbortController | null>(null);

  // Auto-scroll to latest message
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // Focus input on load
  useEffect(() => {
    textareaRef.current?.focus();
  }, []);

  const handleSend = async () => {
    const trimmedInput = input.trim();
    if (!trimmedInput || isStreaming) return;

    setError(null);
    const userMessage: ChatMessage = { role: 'user', content: trimmedInput };
    const newHistory: ChatMessage[] = [...messages, userMessage];

    // Optimistically update message list with user input and an empty assistant placeholder
    setMessages([...newHistory, { role: 'assistant', content: '' }]);
    setInput('');
    setIsStreaming(true);

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

        setMessages((prev) => {
          const updated = [...prev];
          updated[updated.length - 1] = {
            role: 'assistant',
            content: assistantResponse,
          };
          return updated;
        });
      }
    } catch (err: unknown) {
      if (err instanceof Error && err.name === 'AbortError') {
        return;
      }
      const errMessage =
        err instanceof Error ? err.message : 'An unexpected error occurred.';
      setError(errMessage);

      // Remove the empty assistant placeholder if failed completely
      setMessages((prev) => {
        const last = prev[prev.length - 1];
        if (last && last.role === 'assistant' && !last.content) {
          return prev.slice(0, -1);
        }
        return prev;
      });
    } finally {
      setIsStreaming(false);
      abortControllerRef.current = null;
      setTimeout(() => textareaRef.current?.focus(), 50);
    }
  };

  const handleClear = () => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }
    setMessages([]);
    setInput('');
    setError(null);
    setIsStreaming(false);
    textareaRef.current?.focus();
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  return (
    <main className="flex flex-col h-screen bg-zinc-950 text-zinc-100">
      {/* Header */}
      <header className="flex items-center justify-between border-b border-zinc-800/80 bg-zinc-900/60 px-6 py-3.5 backdrop-blur-md">
        <div className="flex items-center space-x-3">
          <div className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse" />
          <h1 className="text-base font-semibold text-zinc-100 tracking-tight">
            Minimal Chatbot
          </h1>
          <span className="text-xs px-2 py-0.5 rounded-full bg-zinc-800 text-zinc-400 border border-zinc-700/50">
            OpenAI Streaming
          </span>
        </div>
        <button
          onClick={handleClear}
          disabled={messages.length === 0 && !input}
          className="text-xs font-medium text-zinc-400 hover:text-zinc-200 disabled:opacity-40 disabled:hover:text-zinc-400 transition-colors px-2.5 py-1.5 rounded-md hover:bg-zinc-800"
        >
          Reset Chat
        </button>
      </header>

      {/* Messages List */}
      <section className="flex-1 overflow-y-auto px-4 py-6 space-y-4">
        <div className="max-w-3xl mx-auto space-y-4">
          {messages.length === 0 && (
            <div className="flex flex-col items-center justify-center min-h-[50vh] text-center text-zinc-500">
              <div className="w-12 h-12 mb-3 rounded-full bg-zinc-900 border border-zinc-800 flex items-center justify-center text-zinc-400">
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  className="w-6 h-6"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                  strokeWidth={1.8}
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z"
                  />
                </svg>
              </div>
              <p className="text-base font-medium text-zinc-300">
                How can I help you today?
              </p>
              <p className="text-sm mt-1 text-zinc-500">
                Type your message below and press Enter to chat.
              </p>
            </div>
          )}

          {messages.map((msg, index) => {
            const isUser = msg.role === 'user';
            const isLatestAssistant =
              !isUser && isStreaming && index === messages.length - 1;

            return (
              <div
                key={index}
                className={`flex w-full ${isUser ? 'justify-end' : 'justify-start'}`}
              >
                <div
                  className={`relative max-w-[85%] sm:max-w-[75%] px-4 py-3 rounded-2xl text-sm leading-relaxed whitespace-pre-wrap break-words shadow-sm ${
                    isUser
                      ? 'bg-blue-600 text-white rounded-tr-sm'
                      : 'bg-zinc-900 text-zinc-100 border border-zinc-800 rounded-tl-sm'
                  }`}
                >
                  <div className="text-[11px] font-medium uppercase tracking-wider mb-1 opacity-60">
                    {isUser ? 'You' : 'Assistant'}
                  </div>
                  <div>
                    {msg.content}
                    {isLatestAssistant && (
                      <span className="inline-block w-1.5 h-4 ml-1 bg-blue-400 animate-pulse align-middle" />
                    )}
                  </div>
                </div>
              </div>
            );
          })}

          {error && (
            <div className="p-3 text-sm text-red-300 bg-red-950/40 border border-red-800/80 rounded-xl flex items-start gap-2">
              <svg
                xmlns="http://www.w3.org/2000/svg"
                className="w-5 h-5 text-red-400 shrink-0 mt-0.5"
                viewBox="0 0 20 20"
                fill="currentColor"
              >
                <path
                  fillRule="evenodd"
                  d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z"
                  clipRule="evenodd"
                />
              </svg>
              <div className="flex-1">
                <span className="font-semibold">Error: </span>
                <span>{error}</span>
              </div>
            </div>
          )}

          <div ref={messagesEndRef} />
        </div>
      </section>

      {/* Input Area */}
      <footer className="border-t border-zinc-800/80 bg-zinc-900/60 p-4 backdrop-blur-md">
        <div className="max-w-3xl mx-auto">
          <form
            onSubmit={(e) => {
              e.preventDefault();
              handleSend();
            }}
            className="flex items-center gap-2"
          >
            <textarea
              ref={textareaRef}
              rows={1}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Type a message... (Press Enter to send, Shift+Enter for new line)"
              disabled={isStreaming}
              className="flex-1 bg-zinc-950/80 border border-zinc-800 text-zinc-100 placeholder-zinc-500 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/50 focus:border-blue-500 resize-none max-h-32 disabled:opacity-60 transition"
            />

            {/* Clear Button */}
            <button
              type="button"
              onClick={handleClear}
              disabled={isStreaming && messages.length === 0}
              className="px-3.5 py-2.5 rounded-xl border border-zinc-700/60 bg-zinc-800/80 hover:bg-zinc-700 text-zinc-300 text-sm font-medium transition disabled:opacity-40 disabled:cursor-not-allowed"
            >
              Clear
            </button>

            {/* Send Button */}
            <button
              type="submit"
              disabled={!input.trim() || isStreaming}
              className="px-4 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-sm font-medium transition disabled:opacity-40 disabled:cursor-not-allowed flex items-center justify-center shrink-0 shadow-sm"
            >
              {isStreaming ? 'Streaming...' : 'Send'}
            </button>
          </form>
        </div>
      </footer>
    </main>
  );
}

