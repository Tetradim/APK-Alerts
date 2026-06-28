import {
  buildAlertTestEvidenceSummary,
  type AlertEvidenceSnapshot,
} from "./alertEvidenceState";
import {
  buildDiscordWebViewHealthSummary,
  type DiscordWebViewHealthSnapshot,
} from "./discordWebViewState";
import type { LiveReadinessSnapshot } from "./liveReadinessState";
import {
  buildPairingDoctorSummary,
  type PairingDoctorSnapshot,
} from "./pairingDoctorState";
import {
  buildPhoneEngineRuntimeSummary,
  type PhoneEngineRuntimeSnapshot,
} from "./phoneEngineRuntimeState";
import type { ReconciliationSnapshot } from "./reconciliationState";
import type { RemoteEngineSnapshot } from "./remoteEngineState";
import {
  buildSetupAutomationSummary,
  buildWindowsApiPreflightSummary,
  type WindowsSetupEvidence,
} from "./setupAutomationState";

export interface MobileSupportBundleInput {
  createdAt: string;
  remote: RemoteEngineSnapshot;
  pairing: PairingDoctorSnapshot;
  phoneRuntime: PhoneEngineRuntimeSnapshot;
  webView: DiscordWebViewHealthSnapshot;
  liveReadiness: LiveReadinessSnapshot;
  alertEvidence: AlertEvidenceSnapshot;
  reconciliation: ReconciliationSnapshot;
  windowsSetup: WindowsSetupEvidence;
}

export interface SetupHealthReportRow {
  key: string;
  label: string;
  statusLabel: string;
  detailLabel: string;
  actionLabel: string;
  blocking: boolean;
}

export interface SetupHealthReportSummary {
  statusLabel: string;
  readyCountLabel: string;
  blockingCountLabel: string;
  nextActionLabel: string;
  blocking: boolean;
  rows: SetupHealthReportRow[];
}

export interface MobileSupportBundle {
  createdAt: string;
  app: "mobile-consolidation";
  remoteConnection: {
    baseApiUrl: string;
    transport: string;
    apiKeyConfigured: boolean;
    apiKeyRedacted: boolean;
  };
  pairing: {
    summary: ReturnType<typeof buildPairingDoctorSummary>;
    status: PairingDoctorSnapshot["status"];
    checkCount: number;
    failedChecks: Array<{
      key: string;
      label: string;
      path: string;
      error: string;
      skipped: boolean;
    }>;
  };
  webView: {
    summary: ReturnType<typeof buildDiscordWebViewHealthSummary>;
    snapshot: DiscordWebViewHealthSnapshot;
  };
  phoneRuntime: {
    summary: ReturnType<typeof buildPhoneEngineRuntimeSummary>;
    snapshot: PhoneEngineRuntimeSnapshot;
  };
  liveReadiness: {
    checkedAt: string;
    readyForLive: boolean;
    liveMoneyReady: boolean;
    blockingCodes: string[];
  };
  alertEvidence: {
    checkedAt: string;
    chainCount: number;
    latestEventId: string;
    latestStatus: string;
    bridgeHealthStatus: string;
  };
  reconciliation: {
    checkedAt: string;
    rowCount: number;
    unresolvedCount: number;
    unresolvedReasons: string[];
  };
  setupAssistant: {
    summary: ReturnType<typeof buildSetupAutomationSummary>;
    windows: WindowsSetupEvidence;
  };
  setupHealthReport: SetupHealthReportSummary;
}

export function buildSetupHealthReportSummary(input: MobileSupportBundleInput): SetupHealthReportSummary {
  const setupAssistant = buildSetupAutomationSummary({
    remote: input.remote,
    pairing: input.pairing,
    phoneRuntime: input.phoneRuntime,
    webView: input.webView,
    liveReadiness: input.liveReadiness,
    windows: input.windowsSetup,
  });
  const apiPreflight = buildWindowsApiPreflightSummary(input.windowsSetup);
  const pairing = buildPairingDoctorSummary(input.pairing);
  const phoneRuntime = buildPhoneEngineRuntimeSummary(input.phoneRuntime);
  const alertRoute = buildAlertTestEvidenceSummary(input.alertEvidence.evidence.chains[0] ?? null);
  const setupItem = (key: string) => setupAssistant.items.find((item) => item.key === key);
  const installer = setupItem("windows_installer");
  const tailscale = setupItem("tailscale_connected");
  const reachability = setupItem("firewall_reachability");
  const pairingDoctor = setupItem("pairing_doctor");

  const rows: SetupHealthReportRow[] = [
    createReportRow({
      key: "windows_installer",
      label: "Windows installer",
      ready: isSetupItemReady(installer),
      readyStatus: installer?.statusLabel ?? "Installed",
      blockedStatus: installer?.statusLabel ?? "Not run",
      readyDetail: installer?.detailLabel ?? "Windows bootstrapper completed.",
      blockedDetail: installer?.detailLabel ?? "Run the Windows bootstrapper on the remote computer.",
      actionLabel: installer?.actionLabel ?? "Run Windows installer",
    }),
    createReportRow({
      key: "tailscale",
      label: "Tailscale",
      ready: isSetupItemReady(tailscale),
      readyStatus: tailscale?.statusLabel ?? "Connected",
      blockedStatus: tailscale?.statusLabel ?? "Disconnected",
      readyDetail: tailscale?.detailLabel ?? "Tailscale address is available.",
      blockedDetail: tailscale?.detailLabel ?? "Install and sign in to Tailscale on Windows.",
      actionLabel: tailscale?.actionLabel ?? "Sign in to Tailscale",
    }),
    createReportRow({
      key: "api_preflight",
      label: "Windows API preflight",
      ready: isSetupItemReady(reachability),
      readyStatus: reachability?.statusLabel ?? apiPreflight.statusLabel,
      blockedStatus: reachability?.statusLabel ?? apiPreflight.statusLabel,
      readyDetail: reachability?.detailLabel ?? apiPreflight.detailLabel,
      blockedDetail: `${reachability?.detailLabel ?? apiPreflight.detailLabel} ${apiPreflight.repairLabel}`,
      actionLabel: reachability?.actionLabel ?? "Repair Windows firewall",
    }),
    createReportRow({
      key: "pairing_doctor",
      label: "Pairing Doctor",
      ready: isSetupItemReady(pairingDoctor),
      readyStatus: pairing.statusLabel,
      blockedStatus: pairing.statusLabel,
      readyDetail: pairing.detailLabel,
      blockedDetail: pairing.detailLabel,
      actionLabel: pairingDoctor?.actionLabel ?? "Run Pairing Doctor",
    }),
    createReportRow({
      key: "phone_engine",
      label: "Phone engine",
      ready: phoneRuntime.canOwnLease,
      readyStatus: "Healthy",
      blockedStatus: phoneRuntime.statusLabel,
      readyDetail: phoneRuntime.detailLabel,
      blockedDetail: phoneRuntime.detailLabel,
      actionLabel: "Start Phone Engine",
    }),
    createReportRow({
      key: "alert_route",
      label: "Alert route",
      ready: !alertRoute.blocking,
      readyStatus: alertRoute.gateLabel,
      blockedStatus: alertRoute.gateLabel,
      readyDetail: `${alertRoute.contractLabel}; ${alertRoute.parserLabel}; ${alertRoute.queueLabel}`,
      blockedDetail: `${alertRoute.contractLabel}; ${alertRoute.parserLabel}; ${alertRoute.queueLabel}`,
      actionLabel: "Run silent alert test",
    }),
    createReportRow({
      key: "smoke_test",
      label: "Unattended smoke test",
      ready: Boolean(input.windowsSetup.unattendedSmokeTestPassedAt),
      readyStatus: "Passed",
      blockedStatus: "Not recorded",
      readyDetail: `Passed ${input.windowsSetup.unattendedSmokeTestPassedAt}`,
      blockedDetail: "Run the unattended setup smoke test after pairing and alert route proof pass.",
      actionLabel: "Run unattended smoke test",
    }),
  ];

  const readyCount = rows.filter((row) => !row.blocking).length;
  const blockingCount = rows.length - readyCount;
  const firstBlocker = rows.find((row) => row.blocking);

  return {
    statusLabel: blockingCount === 0 ? "Setup health clear" : "Setup health blocked",
    readyCountLabel: `${readyCount}/${rows.length} setup proof(s) clear`,
    blockingCountLabel: blockingCount === 0 ? "No setup health blockers" : `${blockingCount} setup health blocker(s)`,
    nextActionLabel: firstBlocker?.actionLabel ?? "Attach setup support bundle",
    blocking: blockingCount > 0,
    rows,
  };
}

export function buildMobileSupportBundle(input: MobileSupportBundleInput): MobileSupportBundle {
  const latestChain = input.alertEvidence.evidence.chains[0] ?? null;
  const reconciliationSummary = input.reconciliation.remote.summary;
  const apiKeyConfigured = Boolean(input.remote.connection.apiKey);
  const setupAssistantSummary = buildSetupAutomationSummary({
    remote: input.remote,
    pairing: input.pairing,
    phoneRuntime: input.phoneRuntime,
    webView: input.webView,
    liveReadiness: input.liveReadiness,
    windows: input.windowsSetup,
  });
  return {
    createdAt: input.createdAt,
    app: "mobile-consolidation",
    remoteConnection: {
      baseApiUrl: input.remote.connection.baseApiUrl,
      transport: input.remote.connection.transport,
      apiKeyConfigured,
      apiKeyRedacted: apiKeyConfigured,
    },
    pairing: {
      summary: buildPairingDoctorSummary(input.pairing),
      status: input.pairing.status,
      checkCount: input.pairing.checks.length,
      failedChecks: input.pairing.checks
        .filter((check) => !check.ok)
        .map((check) => ({
          key: check.key,
          label: check.label,
          path: check.path,
          error: check.error,
          skipped: check.skipped,
        })),
    },
    webView: {
      summary: buildDiscordWebViewHealthSummary(input.webView),
      snapshot: input.webView,
    },
    phoneRuntime: {
      summary: buildPhoneEngineRuntimeSummary(input.phoneRuntime),
      snapshot: input.phoneRuntime,
    },
    liveReadiness: {
      checkedAt: input.liveReadiness.remote.checkedAt,
      readyForLive: input.liveReadiness.remote.readiness.readyForLive,
      liveMoneyReady: input.liveReadiness.remote.liveMoneyReady,
      blockingCodes: input.liveReadiness.remote.readiness.blockingCodes,
    },
    alertEvidence: {
      checkedAt: input.alertEvidence.evidence.checkedAt,
      chainCount: input.alertEvidence.evidence.chains.length,
      latestEventId: latestChain?.eventId ?? "",
      latestStatus: latestChain?.status ?? "",
      bridgeHealthStatus: input.alertEvidence.evidence.bridgeHealth.status,
    },
    reconciliation: {
      checkedAt: input.reconciliation.remote.checkedAt,
      rowCount: reconciliationSummary.rowCount,
      unresolvedCount: reconciliationSummary.unresolvedCount,
      unresolvedReasons: reconciliationSummary.unresolvedReasons,
    },
    setupAssistant: {
      summary: setupAssistantSummary,
      windows: input.windowsSetup,
    },
    setupHealthReport: buildSetupHealthReportSummary(input),
  };
}

export function serializeMobileSupportBundle(bundle: MobileSupportBundle): string {
  return JSON.stringify(bundle, null, 2);
}

function createReportRow({
  key,
  label,
  ready,
  readyStatus,
  blockedStatus,
  readyDetail,
  blockedDetail,
  actionLabel,
}: {
  key: string;
  label: string;
  ready: boolean;
  readyStatus: string;
  blockedStatus: string;
  readyDetail: string;
  blockedDetail: string;
  actionLabel: string;
}): SetupHealthReportRow {
  return {
    key,
    label,
    statusLabel: ready ? readyStatus : blockedStatus,
    detailLabel: ready ? readyDetail : blockedDetail,
    actionLabel,
    blocking: !ready,
  };
}

function isSetupItemReady(item: { blocking: boolean } | undefined): boolean {
  return item ? !item.blocking : false;
}
