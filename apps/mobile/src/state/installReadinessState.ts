import {
  buildDiscordWebViewHealthSummary,
  type DiscordWebViewHealthSnapshot,
} from "./discordWebViewState";
import {
  buildLiveReadinessSummary,
  type LiveReadinessSnapshot,
} from "./liveReadinessState";
import {
  buildPairingDoctorSummary,
  type PairingDoctorSnapshot,
} from "./pairingDoctorState";
import {
  buildPhoneEngineRuntimeSummary,
  type PhoneEngineRuntimeSnapshot,
} from "./phoneEngineRuntimeState";

export interface MobileInstallReadinessInput {
  pairing: PairingDoctorSnapshot;
  webView: DiscordWebViewHealthSnapshot;
  phoneRuntime: PhoneEngineRuntimeSnapshot;
  liveReadiness: LiveReadinessSnapshot;
}

export interface MobileInstallReadinessItem {
  key: string;
  label: string;
  statusLabel: string;
  detailLabel: string;
  blocking: boolean;
}

export interface MobileInstallReadinessSummary {
  statusLabel: string;
  readyCountLabel: string;
  blockingCountLabel: string;
  blocking: boolean;
  items: MobileInstallReadinessItem[];
}

export function buildMobileInstallReadinessSummary(
  input: MobileInstallReadinessInput,
): MobileInstallReadinessSummary {
  const pairing = buildPairingDoctorSummary(input.pairing);
  const webView = buildDiscordWebViewHealthSummary(input.webView);
  const phone = buildPhoneEngineRuntimeSummary(input.phoneRuntime);
  const live = buildLiveReadinessSummary(input.liveReadiness);
  const liveReady =
    Boolean(input.liveReadiness.remote.checkedAt) &&
    input.liveReadiness.remote.readiness.readyForLive;

  const items: MobileInstallReadinessItem[] = [
    {
      key: "pairing",
      label: "Remote pairing",
      statusLabel: pairing.statusLabel,
      detailLabel: pairing.detailLabel,
      blocking: pairing.blocking,
    },
    {
      key: "webview",
      label: "Discord WebView",
      statusLabel: webView.statusLabel,
      detailLabel: webView.detailLabel,
      blocking: webView.blocking,
    },
    {
      key: "phone_runtime",
      label: "Phone engine",
      statusLabel: phone.statusLabel,
      detailLabel: phone.detailLabel,
      blocking: phone.blocking,
    },
    {
      key: "live_readiness",
      label: "Live readiness endpoint",
      statusLabel: liveReady ? "Readiness endpoint clear" : live.readinessLabel,
      detailLabel: liveReady ? `Checked ${input.liveReadiness.remote.checkedAt}` : live.primaryReason,
      blocking: !liveReady,
    },
  ];
  const readyCount = items.filter((item) => !item.blocking).length;
  const blockingCount = items.length - readyCount;

  return {
    statusLabel: blockingCount === 0 ? "Install ready" : "Install blocked",
    readyCountLabel: `${readyCount}/${items.length} ready`,
    blockingCountLabel: blockingCount === 0 ? "No install blockers" : `${blockingCount} install blocker(s)`,
    blocking: blockingCount > 0,
    items,
  };
}
