export type FetchLike = (input: RequestInfo | URL, init?: RequestInit) => Promise<Response>;

export const DEFAULT_REMOTE_FETCH_TIMEOUT_MS = 8_000;

export interface RemoteEndpointClientConfig {
  baseApiUrl: string;
  apiKey?: string | undefined;
  fetchImpl?: FetchLike | undefined;
  timeoutMs?: number | undefined;
}

export type RemoteEndpointClient =
  | {
      ok: true;
      baseApiUrl: string;
      apiKey: string | undefined;
      fetchImpl: FetchLike;
      timeoutMs: number | undefined;
      error: "";
    }
  | {
      ok: false;
      baseApiUrl: "";
      apiKey: string | undefined;
      fetchImpl: null;
      timeoutMs: number | undefined;
      error: string;
    };

export interface RemoteJsonOptions {
  apiKey?: string | undefined;
  timeoutMs?: number | undefined;
  method?: "GET" | "POST" | undefined;
  body?: unknown | undefined;
}

export function normalizeRemoteApiBaseUrl(value: string): string {
  const trimmed = value.trim();
  if (!trimmed) {
    return "";
  }

  try {
    const url = new URL(trimmed);
    url.pathname = url.pathname.replace(/\/+$/, "");
    if (!url.pathname.endsWith("/api")) {
      url.pathname = `${url.pathname}/api`.replace(/\/+/g, "/");
    }
    url.search = "";
    url.hash = "";
    return url.toString().replace(/\/$/, "");
  } catch {
    return "";
  }
}

export function buildRemoteEndpointClient(
  config: RemoteEndpointClientConfig,
): RemoteEndpointClient {
  const baseApiUrl = normalizeRemoteApiBaseUrl(config.baseApiUrl);
  const apiKey = normalizeApiKey(config.apiKey);
  if (!baseApiUrl) {
    return {
      ok: false,
      baseApiUrl: "",
      apiKey,
      fetchImpl: null,
      timeoutMs: config.timeoutMs,
      error: "Remote API URL is invalid.",
    };
  }

  const fetchImpl = config.fetchImpl ?? globalThis.fetch?.bind(globalThis);
  if (!fetchImpl) {
    return {
      ok: false,
      baseApiUrl: "",
      apiKey,
      fetchImpl: null,
      timeoutMs: config.timeoutMs,
      error: "Fetch is not available.",
    };
  }

  return {
    ok: true,
    baseApiUrl,
    apiKey,
    fetchImpl,
    timeoutMs: config.timeoutMs,
    error: "",
  };
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

function normalizeApiKey(apiKey: string | undefined): string | undefined {
  const trimmed = apiKey?.trim();
  return trimmed ? trimmed : undefined;
}

function isAbortError(error: unknown): boolean {
  return error instanceof Error && error.name === "AbortError";
}
