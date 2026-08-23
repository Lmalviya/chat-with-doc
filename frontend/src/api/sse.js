import { BASE_URL, getAuthToken } from './client.js';

/**
 * Fetch-based SSE (Server-Sent Events) streaming with Supabase Bearer Auth.
 *
 * @param {{
 *   path: string,
 *   body: object,
 *   requestId?: string,
 *   signal?: AbortSignal,
 *   onMeta?: (meta: { conversation_id: string, user_message_id?: string }) => void,
 *   onStatus?: (status: { stage: string, content: string }) => void,
 *   onThink?: (thinkDelta: string) => void,
 *   onToken: (token: string) => void,
 *   onDone: (data: object) => void,
 *   onError: (err: Error) => void,
 * }} options
 * @returns {{ abort: () => void }}
 */
export function streamSSE({ path, body, requestId, signal, onMeta, onStatus, onThink, onToken, onDone, onError }) {
  const controller = new AbortController();

  // Combine caller's signal with our internal controller so either can abort
  const signals = [controller.signal];
  if (signal) signals.push(signal);
  const combinedSignal =
    typeof AbortSignal.any === 'function'
      ? AbortSignal.any(signals)
      : controller.signal;

  (async () => {
    let response;
    const token = await getAuthToken();
    try {
      response = await fetch(`${BASE_URL}${path}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Accept: 'text/event-stream',
          ...(requestId ? { 'X-Request-Id': requestId } : {}),
          ...(token ? { 'Authorization': `Bearer ${token}` } : {}),
        },
        body: JSON.stringify(body),
        signal: combinedSignal,
      });
    } catch (err) {
      if (err.name === 'AbortError') return;
      onError?.(err);
      return;
    }

    if (!response.ok) {
      let message = `HTTP ${response.status}`;
      try {
        const bodyData = await response.json();
        message = bodyData.detail ?? bodyData.message ?? message;
      } catch { /* ignore */ }
      onError?.(new Error(message));
      return;
    }

    const reader = response.body.getReader();
    const decoder = new TextDecoder('utf-8');
    let buffer = '';

    try {
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });

        // SSE messages are separated by double newlines
        const parts = buffer.split('\n\n');
        buffer = parts.pop(); // incomplete message stays in buffer

        for (const part of parts) {
          for (const line of part.split('\n')) {
            if (!line.startsWith('data:')) continue;

            const raw = line.slice(5).trim();

            if (raw === '[DONE]') {
              onDone?.({ type: 'done', request_id: requestId });
              return;
            }

            try {
              const event = JSON.parse(raw);

              if (event.type === 'meta') {
                onMeta?.(event);
              } else if (event.type === 'status') {
                onStatus?.(event);
              } else if (event.type === 'think' && event.delta != null) {
                onThink?.(event.delta);
              } else if (event.type === 'chunk' && event.delta != null) {
                onToken?.(event.delta);
              } else if (event.type === 'token' && event.token != null) {
                onToken?.(event.token);
              } else if (event.type === 'done') {
                onDone?.(event);
                return;
              } else if (event.type === 'error') {
                onError?.(new Error(event.message ?? event.detail ?? 'Stream error'));
                return;
              }
            } catch {
              // Non-JSON line — treat as raw token text
              if (raw) onToken?.(raw);
            }
          }
        }
      }
      // Stream ended without explicit [DONE]
      onDone?.({ type: 'done', request_id: requestId });
    } catch (err) {
      if (err.name === 'AbortError') return;
      onError?.(err);
    } finally {
      reader.releaseLock();
    }
  })();

  return { abort: () => controller.abort() };
}
