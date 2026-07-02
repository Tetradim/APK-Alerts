# Sentinel Nexus Live Readiness Contract Tightening Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make live-money readiness fail closed when hidden broker, source, ingestion, trading, or OCO evidence is missing even if the endpoint reports `ready_for_live: true`.

**Architecture:** Keep the normalized live-readiness payload as the source of truth. Tighten the shared `canClaimLiveReady` contract first, then mirror the same gates in the mobile live-arm checklist so the UI explains the exact blocker before arming.

**Tech Stack:** TypeScript, Node test runner, Expo/React Native state modules, npm workspaces.

---

### Task 1: Shared Contract Regression

**Files:**
- Modify: `packages/contracts/src/liveReadiness.test.ts`
- Modify: `packages/contracts/src/liveReadiness.ts`

- [x] **Step 1: Write the failing contract test**

Add a test that starts from `readyPayload`, leaves `ready_for_live: true`, and changes one hidden evidence field at a time:

```ts
test("live-ready claim fails closed when hidden required evidence is missing", () => {
  const variants = [
    {
      name: "unknown broker",
      checks: { broker: { ...readyPayload.checks.broker, active_broker: "unknown" } },
    },
    {
      name: "missing broker fields",
      checks: { broker: { ...readyPayload.checks.broker, missing_required_fields: ["api_secret"] } },
    },
    {
      name: "no enabled sources",
      checks: { source_policy: { ...readyPayload.checks.source_policy, enabled_sources: 0 } },
    },
    {
      name: "unconfigured discord ingestion",
      checks: {
        signal_ingestion: {
          ...readyPayload.checks.signal_ingestion,
          discord_configured: false,
          discord_channel_count: 0,
        },
      },
    },
    {
      name: "missing max position value",
      checks: { trading: { ...readyPayload.checks.trading, max_position_size: null } },
    },
    {
      name: "unprotected position ids",
      checks: {
        exit_automation: {
          ...readyPayload.checks.exit_automation,
          unprotected_open_position_ids: ["pos-1"],
        },
      },
    },
    {
      name: "metadata-only position ids",
      checks: {
        exit_automation: {
          ...readyPayload.checks.exit_automation,
          metadata_only_open_position_ids: ["pos-2"],
        },
      },
    },
  ];

  for (const variant of variants) {
    const readiness = normalizeLiveReadinessPayload({
      ...readyPayload,
      checks: { ...readyPayload.checks, ...variant.checks },
    });
    assert.equal(readiness.readyForLive, true, variant.name);
    assert.equal(canClaimLiveReady(readiness), false, variant.name);
  }
});
```

- [x] **Step 2: Run red verification**

Run: `npm --workspace @sentinel-nexus/contracts exec -- tsx --test src/liveReadiness.test.ts`

Expected: FAIL because at least one hidden evidence variant can still claim live readiness.

- [x] **Step 3: Tighten `canClaimLiveReady`**

Require:
- broker name is not `unknown`
- `missingRequiredFields.length === 0`
- `enabledSources > 0`
- Discord ingestion is configured and has at least one channel
- `maxPositionSize !== null`
- OCO position ID arrays are empty

- [x] **Step 4: Run green contract verification**

Run: `npm --workspace @sentinel-nexus/contracts exec -- tsx --test src/liveReadiness.test.ts`

Expected: PASS.

### Task 2: Mobile Checklist Parity

**Files:**
- Modify: `apps/mobile/src/state/liveReadinessState.test.ts`
- Modify: `apps/mobile/src/state/liveReadinessState.ts`

- [x] **Step 1: Write the failing mobile checklist test**

Add a checklist test that leaves endpoint evidence present but hides required supporting proof:

```ts
test("live arm checklist blocks hidden missing broker source ingestion trading and OCO evidence", () => {
  const hiddenEvidencePayload = {
    ...readyPayload,
    checks: {
      ...readyPayload.checks,
      broker: {
        ...readyPayload.checks.broker,
        active_broker: "unknown",
        missing_required_fields: ["api_secret"],
      },
      source_policy: {
        ...readyPayload.checks.source_policy,
        enabled_sources: 0,
      },
      signal_ingestion: {
        ...readyPayload.checks.signal_ingestion,
        discord_configured: false,
        discord_channel_count: 0,
      },
      trading: {
        ...readyPayload.checks.trading,
        max_position_size: null,
      },
      exit_automation: {
        ...readyPayload.checks.exit_automation,
        unprotected_open_position_ids: ["pos-1"],
      },
    },
  };
  const summary = buildLiveArmChecklistSummary({
    ...getDefaultLiveReadinessSnapshot(),
    remote: {
      checkedAt: "2026-06-27T17:25:00.000Z",
      readiness: normalizeLiveReadinessPayload(hiddenEvidencePayload),
      liveMoneyReady: false,
    },
  });

  assert.equal(summary.gateLabel, "Live checklist blocked");
  assert.equal(summary.items.find((item) => item.key === "broker")?.statusLabel, "Broker blocked");
  assert.equal(summary.items.find((item) => item.key === "source")?.statusLabel, "Source policy blocked");
  assert.equal(summary.items.find((item) => item.key === "ingestion")?.statusLabel, "Live ingestion blocked");
  assert.equal(summary.items.find((item) => item.key === "trading")?.statusLabel, "Trading controls blocked");
  assert.equal(summary.items.find((item) => item.key === "exits")?.statusLabel, "OCO exits blocking");
});
```

- [x] **Step 2: Run red verification**

Run: `npm --workspace @sentinel-nexus/mobile exec -- tsx --test src/state/liveReadinessState.test.ts`

Expected: FAIL because the checklist still treats some hidden evidence as clear.

- [x] **Step 3: Mirror stricter gates in `buildLiveArmChecklistSummary`**

Update broker, source, ingestion, and trading readiness booleans to match the shared contract.

- [x] **Step 4: Run green mobile verification**

Run: `npm --workspace @sentinel-nexus/mobile exec -- tsx --test src/state/liveReadinessState.test.ts`

Expected: PASS.

### Task 3: Batch Verification And Commit

**Files:**
- Verify all modified files.

- [x] **Step 1: Run focused package tests**

Run:

```powershell
npm --workspace @sentinel-nexus/contracts exec -- tsx --test src/liveReadiness.test.ts
npm --workspace @sentinel-nexus/mobile exec -- tsx --test src/state/liveReadinessState.test.ts
```

Expected: PASS.

- [x] **Step 2: Run full verification**

Run:

```powershell
npm test
npm run typecheck
git diff --check
```

Expected: all commands exit 0.

- [ ] **Step 3: Commit and push**

Run:

```powershell
git add docs/superpowers/plans/2026-06-27-sentinel-nexus-live-readiness-contract-tightening.md packages/contracts/src/liveReadiness.ts packages/contracts/src/liveReadiness.test.ts apps/mobile/src/state/liveReadinessState.ts apps/mobile/src/state/liveReadinessState.test.ts
git diff --cached --check
git commit -m "feat: tighten live readiness fail closed gates"
git push
```

Expected: commit and push succeed after verification.
