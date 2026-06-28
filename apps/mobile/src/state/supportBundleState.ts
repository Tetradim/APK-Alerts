import type { AlertEvidenceSnapshot } from "./alertEvidenceState";
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
}

export function buildMobileSupportBundle(input: MobileSupportBundleInput): MobileSupportBundle {
  const latestChain = input.alertEvidence.evidence.chains[0] ?? null;
  const reconciliationSummary = input.reconciliation.remote.summary;
  const apiKeyConfigured = Boolean(input.remote.connection.apiKey);
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
      summary: buildSetupAutomationSummary({
        remote: input.remote,
        pairing: input.pairing,
        phoneRuntime: input.phoneRuntime,
        webView: input.webView,
        liveReadiness: input.liveReadiness,
        windows: input.windowsSetup,
      }),
      windows: input.windowsSetup,
    },
  };
}

export function serializeMobileSupportBundle(bundle: MobileSupportBundle): string {
  return JSON.stringify(bundle, null, 2);
}
