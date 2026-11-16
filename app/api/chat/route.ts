import { NextRequest } from 'next/server';
import { sendChat, ChatMessage } from '@/lib/llm';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const messages: ChatMessage[] = body?.messages;

    if (!Array.isArray(messages) || messages.length === 0) {
      return new Response(
        JSON.stringify({
          error: 'Request body must contain a non-empty "messages" array.',
        }),
        {
          status: 400,
          headers: { 'Content-Type': 'application/json' },
        }
      );
    }

    const textStream = await sendChat(messages);
    const encodedStream = textStream.pipeThrough(new TextEncoderStream());

    return new Response(encodedStream, {
      headers: {
        'Content-Type': 'text/plain; charset=utf-8',
        'Cache-Control': 'no-cache, no-transform',
        'X-Content-Type-Options': 'nosniff',
      },
    });
  } catch (error: unknown) {
    const message =
      error instanceof Error ? error.message : 'An unexpected error occurred.';
    return new Response(JSON.stringify({ error: message }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
}

