export interface ChatMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

const DEFAULT_SYSTEM_PROMPT =
  'You are a helpful, concise, and friendly AI assistant.';

/**
 * Resolves the OpenAI-compatible chat completions endpoint.
 */
function getChatEndpoint(): string {
  const baseUrl = (process.env.LLM_BASE_URL || 'https://api.openai.com/v1')
    .trim()
    .replace(/\/+$/, '');

  if (baseUrl.endsWith('/chat/completions')) {
    return baseUrl;
  }
  return `${baseUrl}/chat/completions`;
}

/**
 * Sends a chat completion request to an OpenAI-compatible endpoint with streaming enabled.
 * Returns a ReadableStream of text chunks.
 */
export async function sendChat(
  messages: ChatMessage[]
): Promise<ReadableStream<string>> {
  const apiKey = process.env.LLM_API_KEY;
  if (!apiKey) {
    throw new Error(
      'Missing LLM_API_KEY. Please configure LLM_API_KEY in your .env file.'
    );
  }

  const model = process.env.LLM_MODEL || 'gpt-4o-mini';
  const endpoint = getChatEndpoint();

  // Inject default system prompt if not present at start
  const fullMessages: ChatMessage[] =
    messages[0]?.role === 'system'
      ? messages
      : [{ role: 'system', content: DEFAULT_SYSTEM_PROMPT }, ...messages];

  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    Authorization: `Bearer ${apiKey}`,
  };

  // If using Google Gemini OpenAI-compatible endpoint, also add x-goog-api-key
  if (endpoint.includes('googleapis.com')) {
    headers['x-goog-api-key'] = apiKey;
  }

  const response = await fetch(endpoint, {
    method: 'POST',
    headers,
    body: JSON.stringify({
      model,
      messages: fullMessages,
      stream: true,
    }),
  });

  if (!response.ok) {
    const errorBody = await response.text().catch(() => '');
    let errorMessage = `LLM API request failed with status ${response.status} (${response.statusText})`;
    try {
      const errorJson = JSON.parse(errorBody);
      if (errorJson?.error?.message) {
        errorMessage = `LLM API error: ${errorJson.error.message}`;
      } else if (errorBody) {
        errorMessage = `LLM API error: ${errorBody}`;
      }
    } catch {
      if (errorBody) {
        errorMessage = `LLM API error: ${errorBody}`;
      }
    }
    throw new Error(errorMessage);
  }

  if (!response.body) {
    throw new Error('LLM API returned an empty response body.');
  }

  const reader = response.body.getReader();
  const decoder = new TextDecoder('utf-8');

  return new ReadableStream<string>({
    async start(controller) {
      let buffer = '';

      try {
        while (true) {
          const { done, value } = await reader.read();
          if (done) {
            break;
          }

          buffer += decoder.decode(value, { stream: true });
          const lines = buffer.split('\n');
          // Retain remainder in buffer
          buffer = lines.pop() ?? '';

          for (const line of lines) {
            const trimmed = line.trim();
            if (!trimmed || trimmed.startsWith(':')) {
              continue;
            }

            if (trimmed === 'data: [DONE]') {
              controller.close();
              return;
            }

            if (trimmed.startsWith('data: ')) {
              const dataStr = trimmed.slice(6).trim();
              if (dataStr === '[DONE]') {
                controller.close();
                return;
              }

              try {
                const parsed = JSON.parse(dataStr);
                const delta = parsed.choices?.[0]?.delta?.content;
                if (delta) {
                  controller.enqueue(delta);
                }
              } catch {
                // Ignore incomplete or non-JSON SSE frames
              }
            }
          }
        }

        // Process any trailing line in buffer
        if (buffer.trim()) {
          const trimmed = buffer.trim();
          if (trimmed.startsWith('data: ') && trimmed !== 'data: [DONE]') {
            try {
              const parsed = JSON.parse(trimmed.slice(6).trim());
              const delta = parsed.choices?.[0]?.delta?.content;
              if (delta) {
                controller.enqueue(delta);
              }
            } catch {
              // Ignore
            }
          }
        }

        controller.close();
      } catch (err) {
        controller.error(err);
      } finally {
        reader.releaseLock();
      }
    },
    cancel() {
      reader.cancel();
    },
  });
}

