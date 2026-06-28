import {
  buildPairingDoctorSummary,
  type PairingDoctorSnapshot,
} from "./pairingDoctorState";
import type { RemoteEngineSnapshot } from "./remoteEngineState";
import type { WindowsSetupEvidence } from "./setupAutomationState";

export const TAILSCALE_ANDROID_PACKAGE = "com.tailscale.ipn";
export const TAILSCALE_PLAY_STORE_URL =
  "https://play.google.com/store/apps/details?id=com.tailscale.ipn";

export type MobileTailscaleSetupActionKey =
  | "install_or_open_tailscale"
  | "import_pairing"
  | "run_pairing_doctor"
  | "ready";

export interface MobileTailscaleSetupAction {
  key: MobileTailscaleSetupActionKey;
  statusLabel: string;
  actionLabel: string;
  detailLabel: string;
  primaryUrl: string;
  fallbackUrl: string;
  blocking: boolean;
}

export interface MobileTailscaleSetupActionInput {
  windows: WindowsSetupEvidence;
  remote: RemoteEngineSnapshot;
  pairing: PairingDoctorSnapshot;
}

export function buildMobileTailscaleSetupAction(
  input: MobileTailscaleSetupActionInput,
): MobileTailscaleSetupAction {
  const pairing = buildPairingDoctorSummary(input.pairing);
  const remoteConfigured = Boolean(input.remote.connection.baseApiUrl);
  const pairingImported = Boolean(input.windows.pairingPackageImportedAt) && remoteConfigured;

  if (pairingImported && !pairing.blocking) {
    return {
      key: "ready",
      statusLabel: "Ready",
      actionLabel: "Tailscale ready",
      detailLabel: `Pairing Doctor passed ${input.pairing.lastCheckedAt || "recently"}.`,
      primaryUrl: "",
      fallbackUrl: "",
      blocking: false,
    };
  }

  if (pairingImported) {
    return {
      key: "run_pairing_doctor",
      statusLabel: "Validate pairing",
      actionLabel: "Run Pairing Doctor",
      detailLabel: "Pairing is imported. Run Pairing Doctor to prove the phone can reach the remote API.",
      primaryUrl: "",
      fallbackUrl: "",
      blocking: true,
    };
  }

  if (input.windows.pairingPackageCreatedAt || input.windows.tailscaleIp || input.windows.tailscaleMagicDnsName) {
    return {
      key: "import_pairing",
      statusLabel: "Import pairing",
      actionLabel: "Import Pairing Link",
      detailLabel: "Open the apkalerts://pair link or paste the JSON from the Windows installer.",
      primaryUrl: "",
      fallbackUrl: "",
      blocking: true,
    };
  }

  return {
    key: "install_or_open_tailscale",
    statusLabel: "Install Tailscale",
    actionLabel: "Install / Open Tailscale",
    detailLabel: "Install Tailscale, sign in to the same tailnet as Windows, then import the pairing link.",
    primaryUrl: TAILSCALE_PLAY_STORE_URL,
    fallbackUrl: TAILSCALE_PLAY_STORE_URL,
    blocking: true,
  };
}
