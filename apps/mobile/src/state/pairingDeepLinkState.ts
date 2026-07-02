import {
  parseRemotePairingPackageInput,
  type RemotePairingPackageInputFormat,
} from "@sentinel-nexus/contracts";
import type { RemoteConnectionDraft } from "./remoteEngineState";
import type { MobilePairingPackageImportResult } from "./setupAutomationState";

export interface PairingDeepLinkApplyDependencies {
  importPairingPackage: (rawPackage: string) => MobilePairingPackageImportResult;
  updateConnectionDraft: (draft: RemoteConnectionDraft) => void;
}

export interface PairingDeepLinkApplyResult {
  handled: boolean;
  imported: boolean;
  inputFormat: RemotePairingPackageInputFormat;
  statusLabel: string;
  error: string;
}

export interface PairingDeepLinkUrlEvent {
  url: string;
}

export interface PairingDeepLinkSubscription {
  remove: () => void;
}

export interface PairingDeepLinkSource {
  getInitialURL: () => Promise<string | null>;
  addEventListener: (
    eventName: "url",
    handler: (event: PairingDeepLinkUrlEvent) => void,
  ) => PairingDeepLinkSubscription;
}

export function applyPairingDeepLink(
  rawUrl: string,
  dependencies: PairingDeepLinkApplyDependencies,
): PairingDeepLinkApplyResult {
  const parsed = parseRemotePairingPackageInput(rawUrl);
  if (parsed.format !== "deep_link") {
    return {
      handled: false,
      imported: false,
      inputFormat: parsed.format,
      statusLabel: "",
      error: "",
    };
  }

  const result = dependencies.importPairingPackage(rawUrl);
  if (!result.ok || !result.connection) {
    return {
      handled: true,
      imported: false,
      inputFormat: result.inputFormat,
      statusLabel: result.error,
      error: result.error,
    };
  }

  dependencies.updateConnectionDraft(result.connection);
  return {
    handled: true,
    imported: true,
    inputFormat: result.inputFormat,
    statusLabel: `Imported pairing deep link at ${result.evidence.pairingPackageImportedAt}`,
    error: "",
  };
}

export function installPairingDeepLinkHandler(
  source: PairingDeepLinkSource,
  dependencies: PairingDeepLinkApplyDependencies,
): () => void {
  let disposed = false;
  const handleUrl = (url: string) => {
    if (!disposed) {
      applyPairingDeepLink(url, dependencies);
    }
  };

  void source.getInitialURL()
    .then((url) => {
      if (url) {
        handleUrl(url);
      }
    })
    .catch((error) => console.warn("[pairingDeepLink] getInitialURL failed:", error));

  const subscription = source.addEventListener("url", (event) => handleUrl(event.url));
  return () => {
    disposed = true;
    subscription.remove();
  };
}
