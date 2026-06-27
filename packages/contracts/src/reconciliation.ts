export type ReconciliationStatus = "reconciled" | "attention";

export interface ReconciliationRow {
  alertId: string;
  ticker: string;
  alertType: string;
  strike: number | null;
  optionType: string;
  expiration: string;
  entryPrice: number | null;
  sellPercentage: number | null;
  processed: boolean;
  tradeExecuted: boolean;
  tradeRequested: boolean;
  tradeId: string;
  tradeStatus: string;
  orderId: string;
  positionId: string;
  positionStatus: string;
  simulated: boolean;
  attentionReason: string;
  status: ReconciliationStatus;
  liveBlocking: boolean;
  contractKey: string;
}

export interface ReconciliationSummary {
  rowCount: number;
  unresolvedCount: number;
  simulatedUnresolvedCount: number;
  unresolvedReasons: string[];
  allClear: boolean;
}

const STRUCTURAL_PROOF_PREFIX = "accepted bridge alert missing ";

export function normalizeReconciliationPayload(input: unknown): ReconciliationRow[] {
  return Array.isArray(input) ? input.map(normalizeReconciliationRow) : [];
}

export function normalizeReconciliationRow(input: unknown): ReconciliationRow {
  const row = asRecord(input);
  const attentionReason = text(row.attention_reason);
  const simulated = exactBoolean(row.simulated);
  const tradeRequested = exactBoolean(row.trade_requested) || exactBoolean(row.trade_executed);
  const ticker = text(row.ticker).toUpperCase();
  const expiration = text(row.expiration);
  const strike = finiteNumberOrNull(row.strike);
  const optionType = text(row.option_type).toUpperCase();

  return {
    alertId: text(row.alert_id),
    ticker,
    alertType: text(row.alert_type),
    strike,
    optionType,
    expiration,
    entryPrice: finiteNumberOrNull(row.entry_price),
    sellPercentage: finiteNumberOrNull(row.sell_percentage),
    processed: exactBoolean(row.processed),
    tradeExecuted: exactBoolean(row.trade_executed),
    tradeRequested,
    tradeId: text(row.trade_id),
    tradeStatus: text(row.trade_status).toLowerCase(),
    orderId: text(row.order_id),
    positionId: text(row.position_id),
    positionStatus: text(row.position_status).toLowerCase(),
    simulated,
    attentionReason,
    status: attentionReason ? "attention" : "reconciled",
    liveBlocking: isLiveBlockingAttention({ attentionReason, simulated, tradeRequested }),
    contractKey: buildContractKey({ ticker, expiration, strike, optionType }),
  };
}

export function summarizeReconciliationRows(rows: ReconciliationRow[]): ReconciliationSummary {
  const unresolvedReasons: string[] = [];
  let unresolvedCount = 0;
  let simulatedUnresolvedCount = 0;

  for (const row of rows) {
    if (!row.attentionReason) {
      continue;
    }
    if (row.simulated && !row.liveBlocking) {
      simulatedUnresolvedCount += 1;
      continue;
    }
    if (row.liveBlocking || !row.simulated) {
      unresolvedCount += 1;
      if (!unresolvedReasons.includes(row.attentionReason)) {
        unresolvedReasons.push(row.attentionReason);
      }
    }
  }

  return {
    rowCount: rows.length,
    unresolvedCount,
    simulatedUnresolvedCount,
    unresolvedReasons,
    allClear: rows.length > 0 && unresolvedCount === 0,
  };
}

function isLiveBlockingAttention(input: {
  attentionReason: string;
  simulated: boolean;
  tradeRequested: boolean;
}): boolean {
  if (!input.attentionReason) {
    return false;
  }
  if (input.attentionReason === "order pending fill" || input.attentionReason === "entry trade has no position") {
    return !input.simulated;
  }
  if (input.attentionReason.startsWith(STRUCTURAL_PROOF_PREFIX)) {
    return input.tradeRequested;
  }
  return !input.simulated;
}

function buildContractKey(input: {
  ticker: string;
  expiration: string;
  strike: number | null;
  optionType: string;
}): string {
  if (!input.ticker || !input.expiration || input.strike === null || !input.optionType) {
    return "";
  }
  return `${input.ticker}-${input.expiration}-${formatStrike(input.strike)}-${input.optionType}`;
}

function formatStrike(value: number): string {
  return Number.isInteger(value) ? String(value) : String(value).replace(/0+$/, "").replace(/\.$/, "");
}

function asRecord(input: unknown): Record<string, unknown> {
  return input !== null && typeof input === "object" && !Array.isArray(input)
    ? input as Record<string, unknown>
    : {};
}

function text(input: unknown): string {
  return typeof input === "string" ? input.trim() : "";
}

function exactBoolean(input: unknown): boolean {
  return typeof input === "boolean" ? input : false;
}

function finiteNumberOrNull(input: unknown): number | null {
  return typeof input === "number" && Number.isFinite(input) ? input : null;
}
