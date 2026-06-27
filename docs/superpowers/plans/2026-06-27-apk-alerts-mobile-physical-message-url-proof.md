# APK Alerts Mobile Physical Message URL Proof Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Block physical alert-test clearance unless the observed Chrome signal includes a Discord message URL.

**Architecture:** Keep capture proof inside `buildAlertTestEvidenceSummary`. Physical tests already require signal-side capture evidence; this batch removes the weak fallback where a local capture path alone can clear physical proof without identifying the Discord message.

**Tech Stack:** TypeScript, Node test runner, Expo/React Native state modules, npm workspaces.

---

### Task 1: Physical Discord Message URL Gate

**Files:**
- Modify: `apps/mobile/src/state/alertEvidenceState.test.ts`
- Modify: `apps/mobile/src/state/alertEvidenceState.ts`

- [x] **Step 1: Write the failing test**

Add a physical bridge test where event id, raw text, parsed payload, source policy, queue proof, audit proof, and signal capture path all pass, but the physical signal has no Discord message `url`:

```ts
assert.equal(summary.modeLabel, "Physical bridge test");
assert.equal(summary.gateLabel, "Blocks test");
assert.equal(summary.captureLabel, "Discord message URL proof missing");
assert.equal(summary.queueLabel, "Order request queued");
assert.equal(summary.blocking, true);
```

- [x] **Step 2: Run red verification**

Run:

```powershell
npm --workspace @apk-alerts/mobile exec -- tsx --test src/state/alertEvidenceState.test.ts
```

Expected: FAIL because physical tests currently clear with a signal capture path but no Discord message URL.

- [x] **Step 3: Require signal-side Discord message URL**

Update `buildAlertCaptureProofSummary(chain)` so physical signal proof:
- returns `"Physical capture proof missing"` when both `signal.capturePath` and `signal.messageUrl` are missing
- returns `"Discord message URL proof missing"` when `signal.capturePath` exists but `signal.messageUrl` is missing
- passes when `signal.messageUrl` exists, preserving the existing capture label preference when both are present

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
git add docs/superpowers/plans/2026-06-27-apk-alerts-mobile-physical-message-url-proof.md apps/mobile/src/state/alertEvidenceState.ts apps/mobile/src/state/alertEvidenceState.test.ts
git diff --cached --check
git commit -m "feat: require physical message url proof"
git push
```

Expected: commit and push succeed after verification.
