import type { AccessibilityState } from "react-native";

export interface ActionButtonAccessibilityOptions {
  busy?: boolean;
  disabled?: boolean;
  busyLabel?: string;
}

export interface ActionButtonAccessibilityProps {
  accessibilityLabel: string;
  accessibilityState: AccessibilityState;
}

export function buildActionButtonAccessibility(
  label: string,
  options: ActionButtonAccessibilityOptions = {},
): ActionButtonAccessibilityProps {
  const busy = options.busy === true;
  const disabled = options.disabled === true;

  return {
    accessibilityLabel: busy && options.busyLabel ? options.busyLabel : label,
    accessibilityState: {
      busy,
      disabled,
    },
  };
}
