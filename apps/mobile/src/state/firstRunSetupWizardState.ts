import type {
  SetupAutomationItem,
  SetupAutomationSummary,
} from "./setupAutomationState";
import type { MobileTailscaleSetupAction } from "./tailscaleSetupState";

export type FirstRunSetupWizardRoute = "/engines" | "/more";

export interface FirstRunSetupWizardInput {
  setup: SetupAutomationSummary;
  tailscale: MobileTailscaleSetupAction;
}

export interface FirstRunSetupWizardSummary {
  titleLabel: string;
  statusLabel: string;
  progressLabel: string;
  detailLabel: string;
  actionLabel: string;
  route: FirstRunSetupWizardRoute;
  blocking: boolean;
}

export function buildFirstRunSetupWizardSummary(
  input: FirstRunSetupWizardInput,
): FirstRunSetupWizardSummary {
  if (input.tailscale.blocking) {
    return {
      titleLabel: "Finish setup",
      statusLabel: "Setup blocked",
      progressLabel: input.setup.readyCountLabel,
      detailLabel: input.tailscale.detailLabel,
      actionLabel: input.tailscale.actionLabel,
      route: "/engines",
      blocking: true,
    };
  }

  const firstBlocker = input.setup.items.find((item) => item.blocking);
  if (firstBlocker) {
    return {
      titleLabel: "Finish setup",
      statusLabel: input.setup.statusLabel,
      progressLabel: input.setup.readyCountLabel,
      detailLabel: firstBlocker.detailLabel,
      actionLabel: firstBlocker.actionLabel,
      route: routeForSetupItem(firstBlocker),
      blocking: true,
    };
  }

  return {
    titleLabel: "Setup ready",
    statusLabel: "Setup ready",
    progressLabel: input.setup.readyCountLabel,
    detailLabel: input.setup.blockingCountLabel,
    actionLabel: "View setup report",
    route: "/more",
    blocking: false,
  };
}

function routeForSetupItem(item: SetupAutomationItem): FirstRunSetupWizardRoute {
  if (item.key === "unattended_smoke_test") {
    return "/more";
  }

  return "/engines";
}
