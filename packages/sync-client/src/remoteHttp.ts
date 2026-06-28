export type FetchLike = (input: RequestInfo | URL, init?: RequestInit) => Promise<Response>;

export const DEFAULT_REMOTE_FETCH_TIMEOUT_MS = 8_000;

export interface RemoteJsonOptions {
  apiKey?: string | undefined;
  timeoutMs?: number | undefined;
  method?: "GET" | "POST" | undefined;
  body?: unknown | undefined;
}

export async function fetchRemoteJson(
  fetchImpl: FetchLike,
  url: string,
  options: RemoteJsonOptions = {},
): Promise<unknown> {
  const timeoutMs = normalizeTimeoutMs(options.timeoutMs);
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const requestInit: RequestInit = {
      headers: buildHeaders(options.apiKey, options.body !== undefined),
      signal: controller.signal,
    };
    if (options.method) {
      requestInit.method = options.method;
    }
    if (options.body !== undefined) {
      requestInit.body = JSON.stringify(options.body);
    }

    const response = await fetchImpl(url, requestInit);
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }
    return await response.json();
  } catch (error) {
    if (isAbortError(error)) {
      throw new Error(`Timed out after ${timeoutMs}ms`);
    }
    throw error;
  } finally {
    clearTimeout(timeoutId);
  }
}

function normalizeTimeoutMs(timeoutMs: number | undefined): number {
  return Number.isInteger(timeoutMs) && timeoutMs && timeoutMs > 0
    ? timeoutMs
    : DEFAULT_REMOTE_FETCH_TIMEOUT_MS;
}

function buildHeaders(apiKey: string | undefined, hasJsonBody: boolean): HeadersInit {
  const headers: Record<string, string> = {};
  if (hasJsonBody) {
    headers["Content-Type"] = "application/json";
  }

  const trimmed = apiKey?.trim();
  if (trimmed) {
    headers["X-API-Key"] = trimmed;
  }
  return headers;
}

function isAbortError(error: unknown): boolean {
  return error instanceof Error && error.name === "AbortError";
}
