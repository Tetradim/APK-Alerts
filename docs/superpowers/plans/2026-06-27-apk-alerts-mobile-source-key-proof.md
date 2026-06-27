# APK Alerts Mobile Source Key Proof Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Block source-policy clearance unless the audited decision includes a stable source key.

**Architecture:** Keep source-policy proof inside `buildSourcePolicySummary`, where channel, author, parser, metadata, and override proof are already evaluated. Add source key presence as a required deterministic identity proof and expose a specific source label when it is missing.

**Tech Stack:** TypeScript, Node test runner, Expo/React Native state modules, npm workspaces.

---

### Task 1: Stable Source Key Gate

**Files:**
- Modify: `apps/mobile/src/state/alertEvidenceState.test.ts`
- Modify: `apps/mobile/src/state/alertEvidenceState.ts`

- [x] **Step 1: Write the failing test**

Add a source policy test where every existing proof passes but `source.key` is missing:

```ts
assert.equal(summary.statusLabel, "Source policy blocked");
assert.equal(summary.gateLabel, "Blocks alert");
assert.equal(summary.sourceLabel, "Chrome Alerts - source key missing");
assert.equal(summary.confidenceLabel, "Parser high >= medium");
assert.equal(summary.channelLabel, "Channel allowed (1 allowlist entry)");
assert.equal(summary.authorLabel, "Author allowed (1 allowlist entry)");
assert.equal(summary.blocking, true);
```

- [x] **Step 2: Run red verification**

Run:

```powershell
npm --workspace @apk-alerts/mobile exec -- tsx --test src/state/alertEvidenceState.test.ts
```

Expected: FAIL because source policy currently clears without a stable `source.key`.

- [x] **Step 3: Require source key proof**

Update `buildSourcePolicySummary` so `passed` also requires `Boolean(source.key)`. Update `formatSourceIdentityLabel` so missing key is visible:

```ts
if (!key) {
  return `${name || "Unknown source"} - source key missing`;
}
```

- [x] **Step 4: Run green verification**

Run:

```powershell
npm --workspace @apk-alerts/mobile exec -- tsx --test src/state/alertEvidenceState.test.ts
```

Expected: PASS.

### Task 2: Batch Verification And Commit

**Files:**
- Verify all modified files.

- [x] **Step 1: Run full verification**

Run:

```powershell
npm test
npm run typecheck
git diff --check
```

Expected: all commands exit 0.

- [ ] **Step 2: Commit and push**

Run:

```powershell
git add docs/superpowers/plans/2026-06-27-apk-alerts-mobile-source-key-proof.md apps/mobile/src/state/alertEvidenceState.ts apps/mobile/src/state/alertEvidenceState.test.ts
git diff --cached --check
git commit -m "feat: require source key proof"
git push
```

Expected: commit and push succeed after verification.
