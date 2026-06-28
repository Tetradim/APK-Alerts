export interface LiveReadinessIssue {
  code: string;
  message: string;
}

export interface LiveReadiness {
  readyForLive: boolean;
  blockingIssues: LiveReadinessIssue[];
  blockingCodes: string[];
  warnings: LiveReadinessIssue[];
  checks: LiveReadinessChecks;
}

export interface LiveReadinessChecks {
  role: {
    activeRole: string;
    valid: boolean;
    liveExecutionAllowed: boolean;
  };
  apiAuth: {
    configured: boolean;
    authlessDesktopMode: boolean;
  };
  credentialKey: {
    configured: boolean;
    valid: boolean;
  };
  broker: {
    activeBroker: string;
    configured: boolean;
    connected: boolean;
    missingRequiredFields: string[];
    capabilities: {
      supportsLiveTrading: boolean;
      supportsOptions: boolean;
      supportsOrderStatus: boolean;
      supportsCancelOrder: boolean;
    };
  };
  sourcePolicy: {
    valid: boolean;
    autoLiveSources: number;
    enabledSources: number;
    error: string;
  };
  signalIngestion: {
    discordConnected: boolean;
    discordConfigured: boolean;
    discordChannelCount: number;
    chromeBridgeHealthy: boolean;
  };
  trading: {
    autoTradingEnabled: boolean;
    simulationMode: boolean;
    maxPositionSize: number | null;
    maxPositionSizeValid: boolean;
  };
  exitAutomation: {
    ocoExitsConfigured: boolean;
    brokerOrderStatusSupported: boolean;
    brokerCancelSupported: boolean;
    unprotectedOpenPositionCount: number;
    unprotectedOpenPositionIds: string[];
    metadataOnlyOpenPositionCount: number;
    metadataOnlyOpenPositionIds: string[];
  };
  runtime: {
    shutdownTriggered: boolean;
    liveTradingArmed: boolean;
    liveTradingArmedUntil: string;
  };
  reconciliation: {
    unresolvedCount: number;
    unresolvedReasons: string[];
  };
  alertChains: {
    attentionCount: number;
    attentionReasons: string[];
    liveBlockingAttentionCount: number;
    liveBlockingAttentionReasons: string[];
  };
  simulationReplay: {
    proofRequired: boolean;
    acceptanceStatus: string;
    expectedCount: number;
    passedCount: number;
    failedCount: number;
    failedEventCount: number;
    failedEventIds: string[];
    missingEventCount: number;
    missingEventIds: string[];
    updatedAt: string;
    replayUrl: string;
  };
  readinessGates: {
    missingGateKeys: string[];
    states: Record<string, unknown>;
  };
}

export function normalizeLiveReadinessPayload(input: unknown): LiveReadiness {
  const payload = asRecord(input);
  const checks = asRecord(payload.checks);
  const structurallyValid = isLiveReadinessPayload(payload);
  const normalizedChecks = normalizeChecks(checks);
  const blockingIssues = normalizeIssues(payload.blocking_issues);
  const blockingCodes = stringArray(payload.blocking_codes);

  if (!structurallyValid) {
    return {
      readyForLive: false,
      blockingIssues: mergeInvalidPayloadIssue(blockingIssues),
      blockingCodes: mergeInvalidPayloadCode(blockingCodes),
      warnings: normalizeIssues(payload.warnings),
      checks: normalizedChecks,
    };
  }

  return {
    readyForLive: exactBoolean(payload.ready_for_live),
    blockingIssues,
    blockingCodes,
    warnings: normalizeIssues(payload.warnings),
    checks: normalizedChecks,
  };
}

export function canClaimLiveReady(readiness: LiveReadiness): boolean {
  const checks = readiness.checks;
  return (
    readiness.readyForLive &&
    readiness.blockingCodes.length === 0 &&
    checks.role.valid &&
    checks.role.liveExecutionAllowed &&
    (checks.apiAuth.configured || checks.apiAuth.authlessDesktopMode) &&
    checks.credentialKey.configured &&
    checks.credentialKey.valid &&
    checks.broker.activeBroker !== "unknown" &&
    checks.broker.configured &&
    checks.broker.connected &&
    checks.broker.missingRequiredFields.length === 0 &&
    checks.broker.capabilities.supportsLiveTrading &&
    checks.broker.capabilities.supportsOptions &&
    checks.broker.capabilities.supportsOrderStatus &&
    checks.broker.capabilities.supportsCancelOrder &&
    checks.sourcePolicy.valid &&
    checks.sourcePolicy.autoLiveSources > 0 &&
    checks.sourcePolicy.enabledSources > 0 &&
    checks.signalIngestion.discordConfigured &&
    checks.signalIngestion.discordChannelCount > 0 &&
    (checks.signalIngestion.discordConnected || checks.signalIngestion.chromeBridgeHealthy) &&
    checks.trading.autoTradingEnabled &&
    !checks.trading.simulationMode &&
    checks.trading.maxPositionSize !== null &&
    checks.trading.maxPositionSizeValid &&
    checks.exitAutomation.ocoExitsConfigured &&
    checks.exitAutomation.brokerOrderStatusSupported &&
    checks.exitAutomation.brokerCancelSupported &&
    checks.exitAutomation.unprotectedOpenPositionCount === 0 &&
    checks.exitAutomation.unprotectedOpenPositionIds.length === 0 &&
    checks.exitAutomation.metadataOnlyOpenPositionCount === 0 &&
    checks.exitAutomation.metadataOnlyOpenPositionIds.length === 0 &&
    !checks.runtime.shutdownTriggered &&
    checks.runtime.liveTradingArmed &&
    checks.reconciliation.unresolvedCount === 0 &&
    checks.alertChains.liveBlockingAttentionCount === 0 &&
    checks.simulationReplay.acceptanceStatus === "passed" &&
    checks.simulationReplay.expectedCount > 0 &&
    checks.simulationReplay.passedCount >= checks.simulationReplay.expectedCount &&
    checks.simulationReplay.failedCount === 0 &&
    checks.simulationReplay.failedEventCount === 0 &&
    checks.simulationReplay.failedEventIds.length === 0 &&
    checks.simulationReplay.missingEventCount === 0 &&
    checks.simulationReplay.missingEventIds.length === 0 &&
    checks.simulationReplay.updatedAt.length > 0 &&
    checks.simulationReplay.replayUrl.length > 0 &&
    checks.readinessGates.missingGateKeys.length === 0
  );
}

function normalizeChecks(checks: Record<string, unknown>): LiveReadinessChecks {
  const role = asRecord(checks.role);
  const apiAuth = asRecord(checks.api_auth);
  const credentialKey = asRecord(checks.credential_key);
  const broker = asRecord(checks.broker);
  const brokerCapabilities = asRecord(broker.capabilities);
  const sourcePolicy = asRecord(checks.source_policy);
  const signalIngestion = asRecord(checks.signal_ingestion);
  const trading = asRecord(checks.trading);
  const exitAutomation = asRecord(checks.exit_automation);
  const runtime = asRecord(checks.runtime);
  const reconciliation = asRecord(checks.reconciliation);
  const alertChains = asRecord(checks.alert_chains);
  const simulationReplay = asRecord(checks.simulation_replay);
  const readinessGates = asRecord(checks.readiness_gates);

  return {
    role: {
      activeRole: text(role.active_role),
      valid: exactBoolean(role.valid),
      liveExecutionAllowed: exactBoolean(role.live_execution_allowed),
    },
    apiAuth: {
      configured: exactBoolean(apiAuth.configured),
      authlessDesktopMode: exactBoolean(apiAuth.authless_desktop_mode),
    },
    credentialKey: {
      configured: exactBoolean(credentialKey.configured),
      valid: exactBoolean(credentialKey.valid),
    },
    broker: {
      activeBroker: text(broker.active_broker) || "unknown",
      configured: exactBoolean(broker.configured),
      connected: exactBoolean(broker.connected),
      missingRequiredFields: stringArray(broker.missing_required_fields),
      capabilities: {
        supportsLiveTrading: exactBoolean(brokerCapabilities.supports_live_trading),
        supportsOptions: exactBoolean(brokerCapabilities.supports_options),
        supportsOrderStatus: exactBoolean(brokerCapabilities.supports_order_status),
        supportsCancelOrder: exactBoolean(brokerCapabilities.supports_cancel_order),
      },
    },
    sourcePolicy: {
      valid: exactBoolean(sourcePolicy.valid),
      autoLiveSources: nonNegativeInteger(sourcePolicy.auto_live_sources),
      enabledSources: nonNegativeInteger(sourcePolicy.enabled_sources),
      error: text(sourcePolicy.error),
    },
    signalIngestion: {
      discordConnected: exactBoolean(signalIngestion.discord_connected),
      discordConfigured: exactBoolean(signalIngestion.discord_configured),
      discordChannelCount: nonNegativeInteger(signalIngestion.discord_channel_count),
      chromeBridgeHealthy: exactBoolean(signalIngestion.chrome_bridge_healthy),
    },
    trading: {
      autoTradingEnabled: exactBoolean(trading.auto_trading_enabled),
      simulationMode: exactBoolean(trading.simulation_mode),
      maxPositionSize: finiteNumberOrNull(trading.max_position_size),
      maxPositionSizeValid: exactBoolean(trading.max_position_size_valid),
    },
    exitAutomation: {
      ocoExitsConfigured: exactBoolean(exitAutomation.oco_exits_configured),
      brokerOrderStatusSupported: exactBoolean(exitAutomation.broker_order_status_supported),
      brokerCancelSupported: exactBoolean(exitAutomation.broker_cancel_supported),
      unprotectedOpenPositionCount: nonNegativeInteger(exitAutomation.unprotected_open_position_count),
      unprotectedOpenPositionIds: stringArray(exitAutomation.unprotected_open_position_ids),
      metadataOnlyOpenPositionCount: nonNegativeInteger(exitAutomation.metadata_only_open_position_count),
      metadataOnlyOpenPositionIds: stringArray(exitAutomation.metadata_only_open_position_ids),
    },
    runtime: {
      shutdownTriggered: exactBoolean(runtime.shutdown_triggered),
      liveTradingArmed: exactBoolean(runtime.live_trading_armed),
      liveTradingArmedUntil: text(runtime.live_trading_armed_until),
    },
    reconciliation: {
      unresolvedCount: nonNegativeInteger(reconciliation.unresolved_count),
      unresolvedReasons: stringArray(reconciliation.unresolved_reasons),
    },
    alertChains: {
      attentionCount: nonNegativeInteger(alertChains.attention_count),
      attentionReasons: stringArray(alertChains.attention_reasons),
      liveBlockingAttentionCount: nonNegativeInteger(alertChains.live_blocking_attention_count),
      liveBlockingAttentionReasons: stringArray(alertChains.live_blocking_attention_reasons),
    },
    simulationReplay: {
      proofRequired: exactBoolean(simulationReplay.proof_required),
      acceptanceStatus: text(simulationReplay.acceptance_status) || "not_provided",
      expectedCount: nonNegativeInteger(simulationReplay.expected_count),
      passedCount: nonNegativeInteger(simulationReplay.passed_count),
      failedCount: nonNegativeInteger(simulationReplay.failed_count),
      failedEventCount: nonNegativeInteger(simulationReplay.failed_event_count),
      failedEventIds: stringArray(simulationReplay.failed_event_ids),
      missingEventCount: nonNegativeInteger(simulationReplay.missing_event_count),
      missingEventIds: stringArray(simulationReplay.missing_event_ids),
      updatedAt: text(simulationReplay.updated_at),
      replayUrl: text(simulationReplay.replay_url),
    },
    readinessGates: {
      missingGateKeys: stringArray(readinessGates.missing_gate_keys),
      states: asRecord(readinessGates.states),
    },
  };
}

function isLiveReadinessPayload(payload: Record<string, unknown>): boolean {
  const checks = asRecord(payload.checks);
  return (
    typeof payload.ready_for_live === "boolean" &&
    Array.isArray(payload.blocking_issues) &&
    Array.isArray(payload.blocking_codes) &&
    Object.keys(checks).length > 0 &&
    hasRecord(checks, "credential_key") &&
    hasRecord(checks, "broker") &&
    hasRecord(checks, "source_policy") &&
    hasRecord(checks, "signal_ingestion") &&
    hasRecord(checks, "runtime") &&
    hasRecord(checks, "simulation_replay") &&
    hasRecord(checks, "exit_automation")
  );
}

function normalizeIssues(input: unknown): LiveReadinessIssue[] {
  return Array.isArray(input)
    ? input.map((issue) => {
      const record = asRecord(issue);
      return {
        code: text(record.code),
        message: text(record.message),
      };
    }).filter((issue) => issue.code || issue.message)
    : [];
}

function mergeInvalidPayloadIssue(issues: LiveReadinessIssue[]): LiveReadinessIssue[] {
  return [
    {
      code: "readiness_payload_invalid",
      message: "Live-readiness payload is missing required typed sections.",
    },
    ...issues.filter((issue) => issue.code !== "readiness_payload_invalid"),
  ];
}

function mergeInvalidPayloadCode(codes: string[]): string[] {
  return ["readiness_payload_invalid", ...codes.filter((code) => code !== "readiness_payload_invalid")];
}

function hasRecord(input: Record<string, unknown>, key: string): boolean {
  return Object.keys(asRecord(input[key])).length > 0;
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

function stringArray(input: unknown): string[] {
  return Array.isArray(input)
    ? input.map((value) => text(value)).filter(Boolean)
    : [];
}

function nonNegativeInteger(input: unknown): number {
  return typeof input === "number" && Number.isInteger(input) && input >= 0 ? input : 0;
}

function finiteNumberOrNull(input: unknown): number | null {
  return typeof input === "number" && Number.isFinite(input) ? input : null;
}
