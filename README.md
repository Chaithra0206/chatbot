# Minimal LLM Wrapper & Simple Chatbot

A lightweight, minimal Next.js chatbot application that connects to any OpenAI-compatible `/v1/chat/completions` endpoint using native `fetch` and streams responses directly to a clean, dark-mode single-page UI.

## Features

- **Lightweight & SDK-Free:** Uses native `fetch` and Web Streams API (`ReadableStream`) with zero heavy LLM SDK dependencies.
- **OpenAI-Compatible:** Works seamlessly with OpenAI, Groq, Ollama, LocalAI, vLLM, DeepSeek, or any OpenAI-compatible provider.
- **Streaming by Default:** Real-time token streaming from server to client with real-time UI updates.
- **Clean Dark-Mode UI:** Responsive dark-mode interface built with Tailwind CSS, supporting `Enter` to send, `Shift+Enter` for new lines, streaming cursor, and a quick Reset/Clear button.
- **Robust Error Handling:** Detects missing API keys and handles upstream API errors with clear, user-friendly feedback.

---

## Project Structure

```text
├── app/
│   ├── api/
│   │   └── chat/
│   │       └── route.ts     # POST API route that pipes LLM stream to client
│   ├── globals.css          # Tailwind CSS styles and dark mode setup
│   ├── layout.tsx           # Root layout metadata & shell
│   └── page.tsx             # Single-page Chat UI with real-time streaming
├── lib/
│   └── llm.ts               # Core LLM wrapper: sendChat(messages)
├── .env.example             # Example environment configuration
├── package.json             # Minimal dependencies (Next.js, React, Tailwind)
├── tailwind.config.ts       # Tailwind CSS configuration
└── tsconfig.json            # TypeScript configuration
```

---

## Getting Started

### 1. Install Dependencies

```bash
npm install
```

### 2. Configure Environment Variables

Copy `.env.example` to `.env` (or `.env.local`):

```bash
cp .env.example .env
```

Edit `.env` with your provider details:

```env
# OpenAI-compatible API base URL (defaults to https://api.openai.com/v1)
LLM_BASE_URL=https://api.openai.com/v1

# Your API Key (required for remote providers)
LLM_API_KEY=your_api_key_here

# Model name (e.g. gpt-4o-mini, gpt-4o, llama-3.3-70b-versatile)
LLM_MODEL=gpt-4o-mini
```

> **Using with Ollama / Local Models:**
> ```env
> LLM_BASE_URL=http://localhost:11434/v1
> LLM_API_KEY=ollama
> LLM_MODEL=llama3.2
> ```

---

## Running the Application

### Development Mode

Run the local dev server at `http://localhost:3000`:

```bash
npm run dev
```

### Production Build

Create an optimized production build:

```bash
npm run build
```

Start the production server:

```bash
npm start
```

