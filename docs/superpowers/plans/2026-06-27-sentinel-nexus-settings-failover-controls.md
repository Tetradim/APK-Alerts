# Sentinel Nexus Settings And Failover Controls Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add real mobile settings for engine priority, engine enablement, transport preference, and failover/offline notifications.

**Architecture:** This slice adds shared settings contracts first, then a mobile Zustand settings store, then a real Settings tab UI. Cockpit remains fail-closed and starts from not-paired state, but now reflects configured preference summaries rather than static text.

**Tech Stack:** TypeScript, npm workspaces, Node test runner through `tsx`, Expo SDK 54, React Native, Zustand.

---

## Scope

This plan implements configuration surfaces and pure decision helpers only. It does not implement native Android foreground service execution, credential provisioning, Tailscale login automation, cloud relay networking, Discord ingestion, or broker execution.

The approved behavior represented here:

- default engine priority is Phone Engine then Remote Engine;
- operators may switch to Remote Engine then Phone Engine;
- operators may disable Phone Engine or Remote Engine independently;
- if both engines are disabled, execution remains disabled;
- Tailscale/private network is default transport;
- cloud relay is optional fallback and can be disabled;
- phone alerts for failover and offline status are configurable;
- no mobile Lab tab, no fake trading data, and no demo broker mode.

## File Structure

- Create `packages/contracts/src/settings.ts`: shared setting types, defaults, validation helpers, and summary helpers.
- Modify `packages/contracts/src/index.ts`: export settings contracts.
- Create `packages/contracts/src/settings.test.ts`: settings contract tests.
- Create `apps/mobile/src/state/settingsState.ts`: Zustand store plus pure update helpers for mobile settings.
- Create `apps/mobile/src/state/settingsState.test.ts`: mobile settings state tests.
- Create `apps/mobile/src/components/SettingRow.tsx`: switch row for settings.
- Create `apps/mobile/src/components/SegmentedChoice.tsx`: accessible segmented-choice control.
- Create `apps/mobile/src/screens/SettingsScreen.tsx`: real settings screen.
- Modify `apps/mobile/app/(tabs)/settings.tsx`: route to `SettingsScreen`.
- Modify `apps/mobile/src/state/operatorState.ts`: include optional settings summary in cockpit copy.
- Modify `apps/mobile/src/screens/CockpitScreen.tsx`: surface settings summary in cockpit.
- Modify `apps/mobile/src/screens/CockpitScreen.test.ts`: keep fail-closed coverage passing with new summary field.

## Task 1: Shared Settings Contracts

**Files:**
- Create: `packages/contracts/src/settings.ts`
- Modify: `packages/contracts/src/index.ts`
- Create: `packages/contracts/src/settings.test.ts`

- [ ] **Step 1: Write settings contract tests**

Create `packages/contracts/src/settings.test.ts`:

```ts
import assert from "node:assert/strict";
import test from "node:test";
import {
  DEFAULT_FAILOVER_SETTINGS,
  buildEnginePriorityLabel,
  buildTransportLabel,
  canAnyEngineRun,
  normalizeFailoverSettings,
} from "./index.js";

test("default failover settings prefer phone then remote over Tailscale", () => {
  assert.equal(DEFAULT_FAILOVER_SETTINGS.enginePriority, "phone_then_remote");
  assert.equal(DEFAULT_FAILOVER_SETTINGS.phoneEngineEnabled, true);
  assert.equal(DEFAULT_FAILOVER_SETTINGS.remoteEngineEnabled, true);
  assert.equal(DEFAULT_FAILOVER_SETTINGS.transportPreference, "tailscale_first");
  assert.equal(DEFAULT_FAILOVER_SETTINGS.allowCloudFallback, true);
  assert.equal(DEFAULT_FAILOVER_SETTINGS.notifyOnFailover, true);
  assert.equal(DEFAULT_FAILOVER_SETTINGS.notifyWhenOffline, true);
});

test("engine availability fails closed when both engines are disabled", () => {
  const settings = normalizeFailoverSettings({
    ...DEFAULT_FAILOVER_SETTINGS,
    phoneEngineEnabled: false,
    remoteEngineEnabled: false,
  });

  assert.equal(canAnyEngineRun(settings), false);
  assert.equal(buildEnginePriorityLabel(settings), "Execution disabled");
});

test("engine priority labels reflect operator preference and disabled engines", () => {
  assert.equal(buildEnginePriorityLabel(DEFAULT_FAILOVER_SETTINGS), "Phone then Remote");
  assert.equal(
    buildEnginePriorityLabel({
      ...DEFAULT_FAILOVER_SETTINGS,
      enginePriority: "remote_then_phone",
    }),
    "Remote then Phone",
  );
  assert.equal(
    buildEnginePriorityLabel({
      ...DEFAULT_FAILOVER_SETTINGS,
      phoneEngineEnabled: false,
    }),
    "Remote only",
  );
  assert.equal(
    buildEnginePriorityLabel({
      ...DEFAULT_FAILOVER_SETTINGS,
      remoteEngineEnabled: false,
    }),
    "Phone only",
  );
});

test("transport labels reflect Tailscale and cloud fallback choices", () => {
  assert.equal(buildTransportLabel(DEFAULT_FAILOVER_SETTINGS), "Tailscale with cloud fallback");
  assert.equal(
    buildTransportLabel({
      ...DEFAULT_FAILOVER_SETTINGS,
      allowCloudFallback: false,
    }),
    "Tailscale only",
  );
  assert.equal(
    buildTransportLabel({
      ...DEFAULT_FAILOVER_SETTINGS,
      transportPreference: "cloud_first",
    }),
    "Cloud relay with Tailscale fallback",
  );
});
```

- [ ] **Step 2: Run failing contract tests**

Run:

```powershell
npm --workspace @sentinel-nexus/contracts test
```

Expected:

- The new settings tests fail because `settings.ts` does not exist.

- [ ] **Step 3: Implement settings contracts**

Create `packages/contracts/src/settings.ts`:

```ts
export type EnginePriority = "phone_then_remote" | "remote_then_phone";
export type TransportPreference = "tailscale_first" | "cloud_first";

export interface FailoverSettings {
  enginePriority: EnginePriority;
  phoneEngineEnabled: boolean;
  remoteEngineEnabled: boolean;
  transportPreference: TransportPreference;
  allowCloudFallback: boolean;
  notifyOnFailover: boolean;
  notifyWhenOffline: boolean;
}

export const DEFAULT_FAILOVER_SETTINGS: FailoverSettings = {
  enginePriority: "phone_then_remote",
  phoneEngineEnabled: true,
  remoteEngineEnabled: true,
  transportPreference: "tailscale_first",
  allowCloudFallback: true,
  notifyOnFailover: true,
  notifyWhenOffline: true,
};

export function normalizeFailoverSettings(settings: FailoverSettings): FailoverSettings {
  return {
    enginePriority: settings.enginePriority,
    phoneEngineEnabled: Boolean(settings.phoneEngineEnabled),
    remoteEngineEnabled: Boolean(settings.remoteEngineEnabled),
    transportPreference: settings.transportPreference,
    allowCloudFallback: Boolean(settings.allowCloudFallback),
    notifyOnFailover: Boolean(settings.notifyOnFailover),
    notifyWhenOffline: Boolean(settings.notifyWhenOffline),
  };
}

export function canAnyEngineRun(settings: FailoverSettings): boolean {
  return settings.phoneEngineEnabled || settings.remoteEngineEnabled;
}

export function buildEnginePriorityLabel(settings: FailoverSettings): string {
  if (!canAnyEngineRun(settings)) {
    return "Execution disabled";
  }

  if (settings.phoneEngineEnabled && !settings.remoteEngineEnabled) {
    return "Phone only";
  }

  if (!settings.phoneEngineEnabled && settings.remoteEngineEnabled) {
    return "Remote only";
  }

  return settings.enginePriority === "phone_then_remote" ? "Phone then Remote" : "Remote then Phone";
}

export function buildTransportLabel(settings: FailoverSettings): string {
  if (settings.transportPreference === "tailscale_first") {
    return settings.allowCloudFallback ? "Tailscale with cloud fallback" : "Tailscale only";
  }

  return settings.allowCloudFallback ? "Cloud relay with Tailscale fallback" : "Cloud relay only";
}
```

Modify `packages/contracts/src/index.ts`:

```ts
export * from "./events.js";
export * from "./lease.js";
export * from "./settings.js";
```

- [ ] **Step 4: Verify contract tests and typecheck**

Run:

```powershell
npm --workspace @sentinel-nexus/contracts test
npm --workspace @sentinel-nexus/contracts run typecheck
```

Expected:

- Contract tests pass.
- Contract typecheck passes.

- [ ] **Step 5: Commit shared settings contracts**

Run:

```powershell
git add packages/contracts/src/settings.ts packages/contracts/src/settings.test.ts packages/contracts/src/index.ts
git commit -m "feat: add failover settings contracts"
```

## Task 2: Mobile Settings State

**Files:**
- Create: `apps/mobile/src/state/settingsState.ts`
- Create: `apps/mobile/src/state/settingsState.test.ts`

- [ ] **Step 1: Write settings state tests**

Create `apps/mobile/src/state/settingsState.test.ts`:

```ts
import assert from "node:assert/strict";
import test from "node:test";
import { DEFAULT_FAILOVER_SETTINGS } from "@sentinel-nexus/contracts";
import {
  buildSettingsSummary,
  createNextSettings,
  getDefaultMobileSettingsSnapshot,
} from "./settingsState.js";

test("default mobile settings summarize phone-primary Tailscale setup", () => {
  const snapshot = getDefaultMobileSettingsSnapshot();
  const summary = buildSettingsSummary(snapshot.failoverSettings);

  assert.equal(snapshot.failoverSettings.enginePriority, "phone_then_remote");
  assert.equal(summary.engineLabel, "Phone then Remote");
  assert.equal(summary.transportLabel, "Tailscale with cloud fallback");
  assert.equal(summary.notificationsLabel, "Failover and offline alerts on");
});

test("settings update can switch to remote-primary without disabling phone fallback", () => {
  const next = createNextSettings(DEFAULT_FAILOVER_SETTINGS, {
    enginePriority: "remote_then_phone",
  });

  assert.equal(next.enginePriority, "remote_then_phone");
  assert.equal(next.phoneEngineEnabled, true);
  assert.equal(next.remoteEngineEnabled, true);
});

test("notification summary reflects disabled failover and offline alerts", () => {
  const summary = buildSettingsSummary({
    ...DEFAULT_FAILOVER_SETTINGS,
    notifyOnFailover: false,
    notifyWhenOffline: false,
  });

  assert.equal(summary.notificationsLabel, "Phone alerts off");
});
```

- [ ] **Step 2: Run failing mobile settings tests**

Run:

```powershell
npm --workspace @sentinel-nexus/mobile test
```

Expected:

- Fails because `settingsState.ts` does not exist.

- [ ] **Step 3: Implement mobile settings state**

Create `apps/mobile/src/state/settingsState.ts`:

```ts
import {
  DEFAULT_FAILOVER_SETTINGS,
  type FailoverSettings,
  buildEnginePriorityLabel,
  buildTransportLabel,
  normalizeFailoverSettings,
} from "@sentinel-nexus/contracts";
import { create } from "zustand";

export interface MobileSettingsSnapshot {
  failoverSettings: FailoverSettings;
}

export interface SettingsSummary {
  engineLabel: string;
  transportLabel: string;
  notificationsLabel: string;
}

export function getDefaultMobileSettingsSnapshot(): MobileSettingsSnapshot {
  return {
    failoverSettings: DEFAULT_FAILOVER_SETTINGS,
  };
}

export function createNextSettings(
  current: FailoverSettings,
  patch: Partial<FailoverSettings>,
): FailoverSettings {
  return normalizeFailoverSettings({
    ...current,
    ...patch,
  });
}

export function buildSettingsSummary(settings: FailoverSettings): SettingsSummary {
  const notificationsLabel =
    settings.notifyOnFailover && settings.notifyWhenOffline
      ? "Failover and offline alerts on"
      : settings.notifyOnFailover
        ? "Failover alerts on"
        : settings.notifyWhenOffline
          ? "Offline alerts on"
          : "Phone alerts off";

  return {
    engineLabel: buildEnginePriorityLabel(settings),
    transportLabel: buildTransportLabel(settings),
    notificationsLabel,
  };
}

interface SettingsState {
  snapshot: MobileSettingsSnapshot;
  updateFailoverSettings: (patch: Partial<FailoverSettings>) => void;
}

export const useSettingsState = create<SettingsState>((set) => ({
  snapshot: getDefaultMobileSettingsSnapshot(),
  updateFailoverSettings: (patch) =>
    set((state) => ({
      snapshot: {
        failoverSettings: createNextSettings(state.snapshot.failoverSettings, patch),
      },
    })),
}));
```

- [ ] **Step 4: Verify mobile settings state**

Run:

```powershell
npm --workspace @sentinel-nexus/mobile test
npm --workspace @sentinel-nexus/mobile run typecheck
```

Expected:

- Mobile tests pass.
- Mobile typecheck passes.

- [ ] **Step 5: Commit mobile settings state**

Run:

```powershell
git add apps/mobile/src/state/settingsState.ts apps/mobile/src/state/settingsState.test.ts
git commit -m "feat: add mobile failover settings state"
```

## Task 3: Settings Screen Controls

**Files:**
- Create: `apps/mobile/src/components/SettingRow.tsx`
- Create: `apps/mobile/src/components/SegmentedChoice.tsx`
- Create: `apps/mobile/src/screens/SettingsScreen.tsx`
- Modify: `apps/mobile/app/(tabs)/settings.tsx`

- [ ] **Step 1: Create setting row component**

Create `apps/mobile/src/components/SettingRow.tsx`:

```tsx
import { StyleSheet, Switch, Text, View } from "react-native";

interface SettingRowProps {
  label: string;
  description: string;
  value: boolean;
  onValueChange: (value: boolean) => void;
}

export function SettingRow({ label, description, value, onValueChange }: SettingRowProps) {
  return (
    <View style={styles.root}>
      <View style={styles.copy}>
        <Text style={styles.label}>{label}</Text>
        <Text style={styles.description}>{description}</Text>
      </View>
      <Switch
        accessibilityLabel={label}
        value={value}
        onValueChange={onValueChange}
        thumbColor={value ? "#dcfce7" : "#cbd5e1"}
        trackColor={{ false: "#334155", true: "#166534" }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    alignItems: "center",
    flexDirection: "row",
    gap: 14,
    minHeight: 64,
    paddingVertical: 10,
  },
  copy: {
    flex: 1,
  },
  label: {
    color: "#f8fafc",
    fontSize: 15,
    fontWeight: "800",
  },
  description: {
    color: "#94a3b8",
    fontSize: 12,
    lineHeight: 17,
    marginTop: 4,
  },
});
```

- [ ] **Step 2: Create segmented choice component**

Create `apps/mobile/src/components/SegmentedChoice.tsx`:

```tsx
import { Pressable, StyleSheet, Text, View } from "react-native";

interface SegmentedChoiceOption<TValue extends string> {
  label: string;
  value: TValue;
}

interface SegmentedChoiceProps<TValue extends string> {
  label: string;
  value: TValue;
  options: readonly SegmentedChoiceOption<TValue>[];
  onChange: (value: TValue) => void;
}

export function SegmentedChoice<TValue extends string>({
  label,
  value,
  options,
  onChange,
}: SegmentedChoiceProps<TValue>) {
  return (
    <View style={styles.root}>
      <Text style={styles.label}>{label}</Text>
      <View style={styles.options}>
        {options.map((option) => {
          const selected = option.value === value;

          return (
            <Pressable
              key={option.value}
              accessibilityLabel={`${label}: ${option.label}`}
              accessibilityRole="button"
              accessibilityState={{ selected }}
              onPress={() => onChange(option.value)}
              style={[styles.option, selected ? styles.selectedOption : styles.unselectedOption]}
            >
              <Text style={[styles.optionText, selected ? styles.selectedText : styles.unselectedText]}>
                {option.label}
              </Text>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    gap: 8,
  },
  label: {
    color: "#94a3b8",
    fontSize: 11,
    fontWeight: "900",
    textTransform: "uppercase",
  },
  options: {
    backgroundColor: "#0f172a",
    borderColor: "#334155",
    borderRadius: 8,
    borderWidth: 1,
    flexDirection: "row",
    padding: 3,
  },
  option: {
    alignItems: "center",
    borderRadius: 6,
    flex: 1,
    minHeight: 44,
    justifyContent: "center",
    paddingHorizontal: 8,
  },
  selectedOption: {
    backgroundColor: "#22c55e",
  },
  unselectedOption: {
    backgroundColor: "transparent",
  },
  optionText: {
    fontSize: 13,
    fontWeight: "900",
    textAlign: "center",
  },
  selectedText: {
    color: "#052e16",
  },
  unselectedText: {
    color: "#cbd5e1",
  },
});
```

- [ ] **Step 3: Create Settings screen**

Create `apps/mobile/src/screens/SettingsScreen.tsx`:

```tsx
import type { EnginePriority, TransportPreference } from "@sentinel-nexus/contracts";
import { StyleSheet, Text, View } from "react-native";
import { ScreenFrame } from "@/components/ScreenFrame";
import { SegmentedChoice } from "@/components/SegmentedChoice";
import { SettingRow } from "@/components/SettingRow";
import { buildSettingsSummary, useSettingsState } from "@/state/settingsState";

const enginePriorityOptions = [
  { label: "Phone then Remote", value: "phone_then_remote" },
  { label: "Remote then Phone", value: "remote_then_phone" },
] as const;

const transportOptions = [
  { label: "Tailscale first", value: "tailscale_first" },
  { label: "Cloud first", value: "cloud_first" },
] as const;

export function SettingsScreen() {
  const failoverSettings = useSettingsState((state) => state.snapshot.failoverSettings);
  const updateFailoverSettings = useSettingsState((state) => state.updateFailoverSettings);
  const summary = buildSettingsSummary(failoverSettings);

  return (
    <ScreenFrame title="Settings" eyebrow="Sentinel Nexus">
      <View style={styles.summaryPanel}>
        <Text style={styles.summaryLabel}>Current failover policy</Text>
        <Text style={styles.summaryValue}>{summary.engineLabel}</Text>
        <Text style={styles.summaryDetail}>{summary.transportLabel}</Text>
        <Text style={styles.summaryDetail}>{summary.notificationsLabel}</Text>
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Engine Priority</Text>
        <SegmentedChoice<EnginePriority>
          label="Active preference"
          value={failoverSettings.enginePriority}
          options={enginePriorityOptions}
          onChange={(enginePriority) => updateFailoverSettings({ enginePriority })}
        />
        <SettingRow
          label="Phone Engine"
          description="Allow this Android device to own the lease when its health checks are passing."
          value={failoverSettings.phoneEngineEnabled}
          onValueChange={(phoneEngineEnabled) => updateFailoverSettings({ phoneEngineEnabled })}
        />
        <SettingRow
          label="Remote Engine"
          description="Allow the Windows Sentinel Echo engine to take over when the phone engine is not healthy."
          value={failoverSettings.remoteEngineEnabled}
          onValueChange={(remoteEngineEnabled) => updateFailoverSettings({ remoteEngineEnabled })}
        />
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Transport</Text>
        <SegmentedChoice<TransportPreference>
          label="Default route"
          value={failoverSettings.transportPreference}
          options={transportOptions}
          onChange={(transportPreference) => updateFailoverSettings({ transportPreference })}
        />
        <SettingRow
          label="Cloud relay fallback"
          description="Use cloud relay only when private transport is unavailable and the operator permits fallback."
          value={failoverSettings.allowCloudFallback}
          onValueChange={(allowCloudFallback) => updateFailoverSettings({ allowCloudFallback })}
        />
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Phone Alerts</Text>
        <SettingRow
          label="Failover alerts"
          description="Notify this phone when active execution is handed between engines."
          value={failoverSettings.notifyOnFailover}
          onValueChange={(notifyOnFailover) => updateFailoverSettings({ notifyOnFailover })}
        />
        <SettingRow
          label="Offline alerts"
          description="Notify this phone when an engine or transport is considered offline."
          value={failoverSettings.notifyWhenOffline}
          onValueChange={(notifyWhenOffline) => updateFailoverSettings({ notifyWhenOffline })}
        />
      </View>
    </ScreenFrame>
  );
}

const styles = StyleSheet.create({
  summaryPanel: {
    backgroundColor: "#ecfdf5",
    borderColor: "#86efac",
    borderRadius: 8,
    borderWidth: 1,
    padding: 14,
  },
  summaryLabel: {
    color: "#166534",
    fontSize: 11,
    fontWeight: "900",
    textTransform: "uppercase",
  },
  summaryValue: {
    color: "#052e16",
    fontSize: 20,
    fontWeight: "900",
    marginTop: 4,
  },
  summaryDetail: {
    color: "#166534",
    fontSize: 13,
    marginTop: 5,
  },
  section: {
    backgroundColor: "#111827",
    borderColor: "#334155",
    borderRadius: 8,
    borderWidth: 1,
    padding: 14,
  },
  sectionTitle: {
    color: "#f8fafc",
    fontSize: 17,
    fontWeight: "900",
    marginBottom: 12,
  },
});
```

- [ ] **Step 4: Route Settings tab to the real screen**

Replace `apps/mobile/app/(tabs)/settings.tsx` with:

```tsx
import { SettingsScreen } from "@/screens/SettingsScreen";

export default SettingsScreen;
```

- [ ] **Step 5: Verify Settings UI compiles**

Run:

```powershell
npm --workspace @sentinel-nexus/mobile run typecheck
```

Expected:

- Mobile typecheck passes.

- [ ] **Step 6: Commit settings UI**

Run:

```powershell
git add apps/mobile/src/components/SettingRow.tsx apps/mobile/src/components/SegmentedChoice.tsx apps/mobile/src/screens/SettingsScreen.tsx "apps/mobile/app/(tabs)/settings.tsx"
git commit -m "feat: add failover settings screen"
```

## Task 4: Cockpit Settings Summary

**Files:**
- Modify: `apps/mobile/src/state/operatorState.ts`
- Modify: `apps/mobile/src/screens/CockpitScreen.tsx`
- Modify: `apps/mobile/src/screens/CockpitScreen.test.ts`

- [ ] **Step 1: Extend cockpit tests for settings summary**

Add this test to `apps/mobile/src/screens/CockpitScreen.test.ts`:

```ts
test("cockpit summary can include configured failover policy", () => {
  const summary = buildCockpitSummary(EXECUTABLE_PHONE_SNAPSHOT, {
    engineLabel: "Phone then Remote",
    transportLabel: "Tailscale with cloud fallback",
    notificationsLabel: "Failover and offline alerts on",
  });

  assert.equal(summary.policyLabel, "Phone then Remote");
  assert.equal(summary.transportPolicyLabel, "Tailscale with cloud fallback");
});
```

- [ ] **Step 2: Run failing mobile tests**

Run:

```powershell
npm --workspace @sentinel-nexus/mobile test
```

Expected:

- Fails because `buildCockpitSummary` does not accept a settings summary yet.

- [ ] **Step 3: Add optional settings summary to cockpit state**

Modify `apps/mobile/src/state/operatorState.ts` so the top imports and interfaces include:

```ts
import type { SettingsSummary } from "./settingsState.js";

export interface CockpitSummary {
  activeEngineLabel: string;
  remoteLabel: string;
  leaseLabel: string;
  readinessLabel: string;
  transportLabel: string;
  syncLabel: string;
  primaryActionLabel: string;
  policyLabel: string;
  transportPolicyLabel: string;
  canExecute: boolean;
}
```

Change the function signature and returned fields:

```ts
export function buildCockpitSummary(
  snapshot: OperatorSnapshot,
  settingsSummary?: SettingsSummary,
): CockpitSummary {
  // keep the existing label and canExecute logic unchanged

  return {
    activeEngineLabel,
    remoteLabel,
    leaseLabel,
    readinessLabel,
    transportLabel,
    syncLabel: snapshot.syncStatus === "synced" ? `Synced ${snapshot.lastSyncLabel}` : "Sync unavailable",
    primaryActionLabel: snapshot.activeEngine === "none" ? "Pair Remote Engine" : "View Engine Health",
    policyLabel: settingsSummary?.engineLabel ?? "No failover policy",
    transportPolicyLabel: settingsSummary?.transportLabel ?? "No transport policy",
    canExecute,
  };
}
```

- [ ] **Step 4: Wire cockpit to settings state**

Modify `apps/mobile/src/screens/CockpitScreen.tsx`:

```tsx
import { buildSettingsSummary, useSettingsState } from "@/state/settingsState";
```

Inside `CockpitScreen`, before calling `buildCockpitSummary`, add:

```tsx
  const failoverSettings = useSettingsState((state) => state.snapshot.failoverSettings);
  const settingsSummary = buildSettingsSummary(failoverSettings);
  const summary = buildCockpitSummary(snapshot, settingsSummary);
```

Replace the existing `const summary = buildCockpitSummary(snapshot);`.

Inside `styles.emptyEvidence`, no style changes are required. Add this block before the `emptyEvidence` block:

```tsx
      <View style={styles.policyPanel}>
        <Text style={styles.policyLabel}>Configured policy</Text>
        <Text style={styles.policyValue}>{summary.policyLabel}</Text>
        <Text style={styles.policyDetail}>{summary.transportPolicyLabel}</Text>
      </View>
```

Add these styles:

```tsx
  policyPanel: { backgroundColor: "#111827", borderColor: "#334155", borderRadius: 8, borderWidth: 1, padding: 14 },
  policyLabel: { color: "#94a3b8", fontSize: 11, fontWeight: "900", textTransform: "uppercase" },
  policyValue: { color: "#f8fafc", fontSize: 16, fontWeight: "900", marginTop: 5 },
  policyDetail: { color: "#94a3b8", fontSize: 13, marginTop: 5 },
```

- [ ] **Step 5: Verify cockpit settings summary**

Run:

```powershell
npm --workspace @sentinel-nexus/mobile test
npm --workspace @sentinel-nexus/mobile run typecheck
```

Expected:

- Mobile tests pass.
- Mobile typecheck passes.

- [ ] **Step 6: Commit cockpit settings summary**

Run:

```powershell
git add apps/mobile/src/state/operatorState.ts apps/mobile/src/screens/CockpitScreen.tsx apps/mobile/src/screens/CockpitScreen.test.ts
git commit -m "feat: show failover policy in cockpit"
```

## Task 5: Verification And Smoke Test

**Files:**
- Modify: `README.md`

- [ ] **Step 1: Update README with settings slice**

Add this bullet under `The foundation slice includes:` in `README.md` after `operator cockpit as the first screen;`:

```markdown
- failover settings for engine priority, engine enablement, transport preference, and phone alerts;
```

- [ ] **Step 2: Run full verification**

Run:

```powershell
npm test
npm run typecheck
```

Expected:

- All workspace tests pass.
- All workspace typechecks pass.

- [ ] **Step 3: Run Expo web smoke test**

Run:

```powershell
npm run mobile:web -- --port 3004
```

Use a browser automation check to verify:

- Cockpit renders first.
- Settings tab renders a real settings screen.
- Engine Priority, Transport, and Phone Alerts sections are visible.
- No exact Lab tab is visible.

Stop the dev server after the smoke test.

- [ ] **Step 4: Commit docs**

Run:

```powershell
git add README.md
git commit -m "docs: document failover settings slice"
```

- [ ] **Step 5: Confirm clean working tree**

Run:

```powershell
git status --short
```

Expected:

- No output.
