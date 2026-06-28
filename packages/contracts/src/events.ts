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
  | "alert.peer.challenge.v1"
  | "alert.peer.response.v1"
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

export interface AlertPeerChallengePayload {
  challengeId: string;
  targetEngineId: EngineId;
  leaseId: string;
  remoteObservedAt: string;
  discordMessageId: string;
  channelId: string;
  authorId: string | null;
  messageUrl: string;
  normalizedTextSha256: string;
  sourceKey: string;
}

export type PeerAlertDecisionStatus = "accepted" | "skipped" | "duplicate" | "unknown";

export interface PeerAlertFingerprint {
  eventId: string;
  discordMessageId: string;
  channelId: string;
  authorId: string | null;
  messageUrl: string;
  normalizedTextSha256: string;
  sourceKey: string;
  parserConfidence: "none" | "low" | "medium" | "high";
  decisionStatus: PeerAlertDecisionStatus;
  queuedAlertId: string;
}

export interface AlertPeerResponsePayload {
  challengeId: string;
  leaseId: string;
  responderEngineId: EngineId;
  respondedAt: string;
  phoneObservedAt: string;
  phoneReceivedAt: string;
  lastAlert: PeerAlertFingerprint | null;
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

export interface BrokerOrderUpdatePayload {
  broker: "alpaca" | "tradier" | "unknown";
  brokerOrderId: string;
  clientOrderId: string | null;
  status: "queued" | "submitted" | "partially_filled" | "filled" | "cancelled" | "rejected" | "unknown";
  symbol: string;
  side: "buy" | "sell";
  quantity: number;
  filledQuantity: number;
  averageFillPrice: number | null;
  updatedAt: string;
}

export interface PositionReconciledPayload {
  broker: "alpaca" | "tradier" | "unknown";
  positionId: string;
  symbol: string;
  quantity: number;
  averageEntryPrice: number | null;
  marketValue: number | null;
  reconciledAt: string;
  open: boolean;
  protectedByOco: boolean;
}

export interface OperatorNotificationPayload {
  severity: "info" | "warning" | "critical";
  code: string;
  message: string;
  actionLabel: string | null;
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
export type AlertPeerChallengeEvent = BaseEvent<"alert.peer.challenge.v1", AlertPeerChallengePayload>;
export type AlertPeerResponseEvent = BaseEvent<"alert.peer.response.v1", AlertPeerResponsePayload>;
export type AlertParseDecisionEvent = BaseEvent<"alert.parse.decision.v1", AlertParseDecisionPayload>;
export type OrderIntentEvent = BaseEvent<"order.intent.v1", OrderIntentPayload>;
export type AnyTradingEvent =
  | EngineHealthEvent
  | TransportHealthEvent
  | LeaseEvent
  | DiscordAlertObservedEvent
  | AlertPeerChallengeEvent
  | AlertPeerResponseEvent
  | AlertParseDecisionEvent
  | OrderIntentEvent
  | BaseEvent<"broker.order.update.v1", BrokerOrderUpdatePayload>
  | BaseEvent<"position.reconciled.v1", PositionReconciledPayload>
  | BaseEvent<"operator.notification.v1", OperatorNotificationPayload>
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
  "alert.peer.challenge.v1": AlertPeerChallengePayload;
  "alert.peer.response.v1": AlertPeerResponsePayload;
  "alert.parse.decision.v1": AlertParseDecisionPayload;
  "order.intent.v1": OrderIntentPayload;
  "broker.order.update.v1": BrokerOrderUpdatePayload;
  "position.reconciled.v1": PositionReconciledPayload;
  "operator.notification.v1": OperatorNotificationPayload;
  "emergency.stop.v1": { reason: string };
}

export type TradingEventPayload<TType extends TradingEventType> = TradingEventPayloadByType[TType];

export type CreateEventInput<TType extends TradingEventType = TradingEventType> =
  TType extends TradingEventType
    ? {
        id: string;
        type: TType;
        sourceEngineId: EngineId;
        observedAt: string;
        sequence: number;
        previousEventId?: string | null;
        idempotencyKey?: string | null;
        payload: TradingEventPayloadByType[TType];
      }
    : never;

export function createEvent<TInput extends CreateEventInput>(
  input: TInput,
): BaseEvent<TInput["type"], TInput["payload"]> {
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
    .map((part) => part.trim())
    .join(":")
    .trim()
    .toLowerCase();
}
