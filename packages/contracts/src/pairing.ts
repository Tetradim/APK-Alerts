export type PairingEndpointMethod = "GET" | "POST";
export type PairingTransportHint = "tailscale" | "same_wifi" | "cloud_relay" | "manual";

export interface RemotePairingEndpoint {
  key: string;
  method: PairingEndpointMethod;
  path: string;
  requiresApiKey: boolean;
  label: string;
}

export interface RemotePairingBlockingIssue {
  code: string;
  message: string;
}

export interface RemotePairingStatus {
  version: number;
  serverTime: string;
  apiAuthConfigured: boolean;
  apiKeyRequired: boolean;
  remoteBind: {
    host: string;
    port: number;
    remoteAccessible: boolean;
  };
  chromeBridgeRemoteEnabled: boolean;
  baseApiUrlHint: string;
  requiredEndpoints: RemotePairingEndpoint[];
  blockingIssues: RemotePairingBlockingIssue[];
}

export interface RemotePairingConfig {
  version: number;
  app: string;
  createdAt: string;
  remoteApiUrl: string;
  apiKey: string;
  transportHint: PairingTransportHint;
  requiredEndpoints: RemotePairingEndpoint[];
}

export type RemotePairingPackageInputFormat = "json" | "deep_link" | "unknown";

export interface RemotePairingPackageInputResult {
  ok: boolean;
  format: RemotePairingPackageInputFormat;
  config: RemotePairingConfig;
  error: string;
}

const PAIRING_DEEP_LINK_SCHEME = "sentinelnexus:";
const PAIRING_DEEP_LINK_HOST = "pair";
const BASE64_URL_ALPHABET = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_";

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function cleanString(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

function strictBoolean(value: unknown): boolean {
  return value === true;
}

function nonNegativeInteger(value: unknown): number {
  return typeof value === "number" && Number.isInteger(value) && value >= 0 ? value : 0;
}

function normalizeEndpoint(value: unknown): RemotePairingEndpoint | null {
  if (!isRecord(value)) {
    return null;
  }

  const key = cleanString(value.key);
  const path = cleanString(value.path);
  if (!key || !path.startsWith("/")) {
    return null;
  }

  return {
    key,
    method: value.method === "POST" ? "POST" : "GET",
    path,
    requiresApiKey: strictBoolean(value.requires_api_key ?? value.requiresApiKey),
    label: cleanString(value.label) || key,
  };
}

function normalizeBlockingIssue(value: unknown): RemotePairingBlockingIssue | null {
  if (!isRecord(value)) {
    return null;
  }
  const code = cleanString(value.code);
  const message = cleanString(value.message);
  return code ? { code, message } : null;
}

function normalizeEndpoints(value: unknown): RemotePairingEndpoint[] {
  return Array.isArray(value) ? value.map(normalizeEndpoint).filter((entry) => entry !== null) : [];
}

function normalizeBlockingIssues(value: unknown): RemotePairingBlockingIssue[] {
  return Array.isArray(value)
    ? value.map(normalizeBlockingIssue).filter((entry) => entry !== null)
    : [];
}

function normalizeTransportHint(value: unknown): PairingTransportHint {
  return value === "tailscale" || value === "same_wifi" || value === "cloud_relay"
    ? value
    : "manual";
}

export function normalizeRemotePairingStatusPayload(payload: unknown): RemotePairingStatus {
  if (!isRecord(payload)) {
    return {
      version: 0,
      serverTime: "",
      apiAuthConfigured: false,
      apiKeyRequired: true,
      remoteBind: {
        host: "",
        port: 0,
        remoteAccessible: false,
      },
      chromeBridgeRemoteEnabled: false,
      baseApiUrlHint: "",
      requiredEndpoints: [],
      blockingIssues: [
        {
          code: "invalid_pairing_status_payload",
          message: "Remote pairing status payload was malformed.",
        },
      ],
    };
  }

  const remoteBind = isRecord(payload.remote_bind) ? payload.remote_bind : payload.remoteBind;
  const bind = isRecord(remoteBind) ? remoteBind : {};

  return {
    version: nonNegativeInteger(payload.version),
    serverTime: cleanString(payload.server_time ?? payload.serverTime),
    apiAuthConfigured: strictBoolean(payload.api_auth_configured ?? payload.apiAuthConfigured),
    apiKeyRequired: (payload.api_key_required ?? payload.apiKeyRequired) === false ? false : true,
    remoteBind: {
      host: cleanString(bind.host),
      port: nonNegativeInteger(bind.port),
      remoteAccessible: strictBoolean(bind.remote_accessible ?? bind.remoteAccessible),
    },
    chromeBridgeRemoteEnabled: strictBoolean(
      payload.chrome_bridge_remote_enabled ?? payload.chromeBridgeRemoteEnabled,
    ),
    baseApiUrlHint: cleanString(payload.base_api_url_hint ?? payload.baseApiUrlHint),
    requiredEndpoints: normalizeEndpoints(payload.required_endpoints ?? payload.requiredEndpoints),
    blockingIssues: normalizeBlockingIssues(payload.blocking_issues ?? payload.blockingIssues),
  };
}

export function normalizeRemotePairingConfigPayload(payload: unknown): RemotePairingConfig {
  const input = isRecord(payload) ? payload : {};
  return {
    version: nonNegativeInteger(input.version),
    app: cleanString(input.app),
    createdAt: cleanString(input.created_at ?? input.createdAt),
    remoteApiUrl: cleanString(input.remote_api_url ?? input.remoteApiUrl),
    apiKey: cleanString(input.api_key ?? input.apiKey),
    transportHint: normalizeTransportHint(input.transport_hint ?? input.transportHint),
    requiredEndpoints: normalizeEndpoints(input.required_endpoints ?? input.requiredEndpoints),
  };
}

export function buildRemotePairingDeepLink(config: RemotePairingConfig): string {
  const payload = {
    version: config.version,
    app: config.app,
    createdAt: config.createdAt,
    remoteApiUrl: config.remoteApiUrl,
    apiKey: config.apiKey,
    transportHint: config.transportHint,
    requiredEndpoints: config.requiredEndpoints,
  };
  return `sentinelnexus://pair?payload=${encodeBase64Url(JSON.stringify(payload))}`;
}

export function parseRemotePairingPackageInput(rawInput: string): RemotePairingPackageInputResult {
  const input = cleanString(rawInput);
  const jsonRecord = parseJsonRecord(input);
  if (jsonRecord) {
    return parsedPairingPackageInput("json", jsonRecord);
  }

  const deepLink = parsePairingDeepLink(input);
  if (deepLink.ok) {
    return parsedPairingPackageInput("deep_link", deepLink.payload);
  }
  if (deepLink.matched) {
    return failedPairingPackageInput("deep_link", deepLink.error);
  }

  return failedPairingPackageInput(
    "unknown",
    "Pairing package must be valid JSON or an sentinelnexus://pair deep link.",
  );
}

function parsedPairingPackageInput(
  format: RemotePairingPackageInputFormat,
  payload: Record<string, unknown>,
): RemotePairingPackageInputResult {
  return {
    ok: true,
    format,
    config: normalizeRemotePairingConfigPayload(payload),
    error: "",
  };
}

function failedPairingPackageInput(
  format: RemotePairingPackageInputFormat,
  error: string,
): RemotePairingPackageInputResult {
  return {
    ok: false,
    format,
    config: normalizeRemotePairingConfigPayload(null),
    error,
  };
}

function parsePairingDeepLink(input: string):
  | { ok: true; matched: true; payload: Record<string, unknown> }
  | { ok: false; matched: boolean; error: string } {
  let url: URL;
  try {
    url = new URL(input);
  } catch {
    return { ok: false, matched: false, error: "" };
  }

  const route = url.hostname || url.pathname.replace(/^\/+/, "");
  const matched = url.protocol === PAIRING_DEEP_LINK_SCHEME && route === PAIRING_DEEP_LINK_HOST;
  if (!matched) {
    return { ok: false, matched: false, error: "" };
  }

  const payload = cleanString(url.searchParams.get("payload") ?? url.searchParams.get("p"));
  if (!payload) {
    return { ok: false, matched: true, error: "Pairing deep link is missing a payload." };
  }

  const json = decodeBase64UrlToString(payload);
  const parsed = json ? parseJsonRecord(json) : null;
  if (!parsed) {
    return {
      ok: false,
      matched: true,
      error: "Pairing deep link must contain a valid pairing payload.",
    };
  }

  return { ok: true, matched: true, payload: parsed };
}

function parseJsonRecord(input: string): Record<string, unknown> | null {
  try {
    const parsed: unknown = JSON.parse(input);
    return isRecord(parsed) ? parsed : null;
  } catch {
    return null;
  }
}

function encodeBase64Url(input: string): string {
  const bytes = stringToUtf8Bytes(input);
  let output = "";

  for (let index = 0; index < bytes.length; index += 3) {
    const first = bytes[index] ?? 0;
    const second = bytes[index + 1];
    const third = bytes[index + 2];
    const combined = (first << 16) | ((second ?? 0) << 8) | (third ?? 0);

    output += BASE64_URL_ALPHABET[(combined >> 18) & 63];
    output += BASE64_URL_ALPHABET[(combined >> 12) & 63];
    if (second !== undefined) {
      output += BASE64_URL_ALPHABET[(combined >> 6) & 63];
    }
    if (third !== undefined) {
      output += BASE64_URL_ALPHABET[combined & 63];
    }
  }

  return output;
}

function decodeBase64UrlToString(input: string): string | null {
  const bytes: number[] = [];
  let buffer = 0;
  let bits = 0;

  for (const char of input) {
    const value = BASE64_URL_ALPHABET.indexOf(char);
    if (value < 0) {
      return null;
    }
    buffer = (buffer << 6) | value;
    bits += 6;
    if (bits >= 8) {
      bits -= 8;
      bytes.push((buffer >> bits) & 255);
    }
  }

  return utf8BytesToString(bytes);
}

function stringToUtf8Bytes(input: string): number[] {
  const encoded = encodeURIComponent(input);
  const bytes: number[] = [];
  for (let index = 0; index < encoded.length; index += 1) {
    const char = encoded[index];
    if (char === "%") {
      bytes.push(Number.parseInt(encoded.slice(index + 1, index + 3), 16));
      index += 2;
    } else if (char) {
      bytes.push(char.charCodeAt(0));
    }
  }
  return bytes;
}

function utf8BytesToString(bytes: number[]): string | null {
  try {
    return decodeURIComponent(bytes.map((byte) => `%${byte.toString(16).padStart(2, "0")}`).join(""));
  } catch {
    return null;
  }
}
