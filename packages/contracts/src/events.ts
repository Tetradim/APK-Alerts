export type EngineRole = "phone" | "remote";
export type EngineId = `${EngineRole}:${string}`;
export type TransportKind = "same_wifi" | "tailscale" | "cloud_relay";
export type EngineHealthStatus = "healthy" | "degraded" | "offline";

export type TradingEventType =
  | "engine.health.v1"
  | "transport.health.v1"
  | "lease.requested.v1"
  | "lease.acquired.v1"
  | "lease.renewed.v1"
  | "lease.relinquished.v1"
  | "lease.expired.v1"
  | "discord.alert.observed.v1"
  | "alert.parse.decision.v1"
  | "order.intent.v1"
  | "broker.order.update.v1"
  | "position.reconciled.v1"
  | "operator.notification.v1"
  | "emergency.stop.v1";

export interface BaseEvent<TType extends TradingEventType, TPayload> {
  id: string;
  type: TType;
  schemaVersion: 1;
  sourceEngineId: EngineId;
  observedAt: string;
  sequence: number;
  previousEventId: string | null;
  idempotencyKey: string | null;
  payload: TPayload;
}

export interface EngineHealthPayload {
  engineRole: EngineRole;
  status: EngineHealthStatus;
  leaseEligible: boolean;
  reason: string | null;
}

export interface TransportHealthPayload {
  kind: TransportKind;
  status: "connected" | "degraded" | "disconnected";
  remoteAddress: string | null;
}

export interface LeasePayload {
  leaseId: string;
  holderEngineId: EngineId | null;
  expiresAt: string | null;
  reason: string;
}

export interface DiscordAlertObservedPayload {
  discordMessageId: string;
  channelId: string;
  authorId: string | null;
  normalizedTextSha256: string;
}

export interface AlertParseDecisionPayload {
  discordMessageId: string;
  accepted: boolean;
  confidence: "none" | "low" | "medium" | "high";
  decisionReason: string;
  contractKey: string | null;
}

export interface OrderIntentPayload {
  alertEventId: string;
  broker: "alpaca" | "tradier" | "unknown";
  side: "buy" | "sell";
  contractKey: string;
  quantity: number;
}

export type EngineHealthEvent = BaseEvent<"engine.health.v1", EngineHealthPayload>;
export type TransportHealthEvent = BaseEvent<"transport.health.v1", TransportHealthPayload>;
export type LeaseEvent = BaseEvent<
  | "lease.requested.v1"
  | "lease.acquired.v1"
  | "lease.renewed.v1"
  | "lease.relinquished.v1"
  | "lease.expired.v1",
  LeasePayload
>;
export type DiscordAlertObservedEvent = BaseEvent<"discord.alert.observed.v1", DiscordAlertObservedPayload>;
export type AlertParseDecisionEvent = BaseEvent<"alert.parse.decision.v1", AlertParseDecisionPayload>;
export type OrderIntentEvent = BaseEvent<"order.intent.v1", OrderIntentPayload>;
export type AnyTradingEvent =
  | EngineHealthEvent
  | TransportHealthEvent
  | LeaseEvent
  | DiscordAlertObservedEvent
  | AlertParseDecisionEvent
  | OrderIntentEvent
  | BaseEvent<"broker.order.update.v1", Record<string, unknown>>
  | BaseEvent<"position.reconciled.v1", Record<string, unknown>>
  | BaseEvent<"operator.notification.v1", Record<string, unknown>>
  | BaseEvent<"emergency.stop.v1", { reason: string }>;

export interface TradingEventPayloadByType {
  "engine.health.v1": EngineHealthPayload;
  "transport.health.v1": TransportHealthPayload;
  "lease.requested.v1": LeasePayload;
  "lease.acquired.v1": LeasePayload;
  "lease.renewed.v1": LeasePayload;
  "lease.relinquished.v1": LeasePayload;
  "lease.expired.v1": LeasePayload;
  "discord.alert.observed.v1": DiscordAlertObservedPayload;
  "alert.parse.decision.v1": AlertParseDecisionPayload;
  "order.intent.v1": OrderIntentPayload;
  "broker.order.update.v1": Record<string, unknown>;
  "position.reconciled.v1": Record<string, unknown>;
  "operator.notification.v1": Record<string, unknown>;
  "emergency.stop.v1": { reason: string };
}

export type TradingEventPayload<TType extends TradingEventType> = TradingEventPayloadByType[TType];

export interface CreateEventInput<TType extends TradingEventType> {
  id: string;
  type: TType;
  sourceEngineId: EngineId;
  observedAt: string;
  sequence: number;
  previousEventId?: string | null;
  idempotencyKey?: string | null;
  payload: TradingEventPayloadByType[TType];
}

export function createEvent<TType extends TradingEventType>(
  input: CreateEventInput<TType>,
): BaseEvent<TType, TradingEventPayloadByType[TType]> {
  return {
    id: input.id,
    type: input.type,
    schemaVersion: 1,
    sourceEngineId: input.sourceEngineId,
    observedAt: input.observedAt,
    sequence: input.sequence,
    previousEventId: input.previousEventId ?? null,
    idempotencyKey: input.idempotencyKey ?? null,
    payload: input.payload,
  };
}

export function buildIdempotencyKey(parts: {
  source: "discord" | "operator" | "reconciliation";
  intent: string;
  externalId: string;
  contractKey?: string | null;
}): string {
  return [
    parts.source,
    parts.intent,
    parts.externalId,
    parts.contractKey ?? "none",
  ]
    .join(":")
    .trim()
    .toLowerCase();
}
