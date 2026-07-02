import assert from "node:assert/strict";
import test from "node:test";
import type { SetupAutomationSummary } from "./setupAutomationState.js";
import type { MobileTailscaleSetupAction } from "./tailscaleSetupState.js";
import { buildFirstRunSetupWizardSummary } from "./firstRunSetupWizardState.js";

function setupSummary(
  overrides: Partial<SetupAutomationSummary> = {},
): SetupAutomationSummary {
  return {
    statusLabel: "Setup blocked",
    readyCountLabel: "0/10 ready",
    blockingCountLabel: "10 setup blocker(s)",
    nextActionLabel: "Run Windows installer",
    blocking: true,
    items: [
      {
        key: "windows_installer",
        label: "Windows installer",
        statusLabel: "Not run",
        detailLabel: "Run the Windows bootstrapper on the remote Sentinel Echo computer.",
        actionLabel: "Run Windows installer",
        blocking: true,
      },
    ],
    ...overrides,
  };
}

function tailscaleAction(
  overrides: Partial<MobileTailscaleSetupAction> = {},
): MobileTailscaleSetupAction {
  return {
    key: "install_or_open_tailscale",
    statusLabel: "Install Tailscale",
    actionLabel: "Install / Open Tailscale",
    detailLabel: "Install Tailscale, sign in to the same tailnet as Windows, then import the pairing link.",
    primaryUrl: "https://play.google.com/store/apps/details?id=com.tailscale.ipn",
    fallbackUrl: "https://play.google.com/store/apps/details?id=com.tailscale.ipn",
    blocking: true,
    ...overrides,
  };
}

test("first run wizard starts with the mobile Tailscale action", () => {
  const summary = buildFirstRunSetupWizardSummary({
    setup: setupSummary(),
    tailscale: tailscaleAction(),
  });

  assert.equal(summary.statusLabel, "Setup blocked");
  assert.equal(summary.titleLabel, "Finish setup");
  assert.equal(summary.actionLabel, "Install / Open Tailscale");
  assert.equal(summary.route, "/engines");
  assert.equal(summary.blocking, true);
  assert.match(summary.detailLabel, /same tailnet/);
  assert.doesNotMatch(JSON.stringify(summary), /apiKey|secret|token/i);
});

test("first run wizard routes setup smoke proof to More", () => {
  const summary = buildFirstRunSetupWizardSummary({
    setup: setupSummary({
      readyCountLabel: "9/10 ready",
      blockingCountLabel: "1 setup blocker(s)",
      nextActionLabel: "Run unattended smoke test",
      items: [
        {
          key: "unattended_smoke_test",
          label: "Unattended smoke test",
          statusLabel: "Not proven",
          detailLabel: "Run an unattended alert smoke test after pairing and health checks pass.",
          actionLabel: "Run unattended smoke test",
          blocking: true,
        },
      ],
    }),
    tailscale: tailscaleAction({
      key: "ready",
      statusLabel: "Ready",
      actionLabel: "Tailscale ready",
      detailLabel: "Pairing Doctor passed recently.",
      primaryUrl: "",
      fallbackUrl: "",
      blocking: false,
    }),
  });

  assert.equal(summary.actionLabel, "Run unattended smoke test");
  assert.equal(summary.route, "/more");
  assert.equal(summary.progressLabel, "9/10 ready");
  assert.match(summary.detailLabel, /alert smoke test/);
});

test("first run wizard exposes ready setup as non-blocking", () => {
  const summary = buildFirstRunSetupWizardSummary({
    setup: setupSummary({
      statusLabel: "Setup ready",
      readyCountLabel: "10/10 ready",
      blockingCountLabel: "No setup blockers",
      nextActionLabel: "Run unattended smoke test regularly",
      blocking: false,
      items: [],
    }),
    tailscale: tailscaleAction({
      key: "ready",
      statusLabel: "Ready",
      actionLabel: "Tailscale ready",
      detailLabel: "Pairing Doctor passed recently.",
      primaryUrl: "",
      fallbackUrl: "",
      blocking: false,
    }),
  });

  assert.equal(summary.statusLabel, "Setup ready");
  assert.equal(summary.actionLabel, "View setup report");
  assert.equal(summary.route, "/more");
  assert.equal(summary.blocking, false);
  assert.equal(summary.progressLabel, "10/10 ready");
});
