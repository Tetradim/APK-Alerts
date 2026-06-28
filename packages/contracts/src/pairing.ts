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
  return typeof value === "number" && Number.isFinite(value) && value >= 0
    ? Math.floor(value)
    : 0;
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
