# APK Alerts Mobile Physical Parsed Payload Proof Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Block physical alert-test clearance when the Chrome-observed parsed payload differs from the audited parsed payload.

**Architecture:** Keep parser proof inside `buildAlertTestEvidenceSummary`. The previous batch requires parsed payload presence; this batch adds deterministic equality for physical signal/audit pairs by comparing canonical JSON, while preserving silent audit-only behavior.

**Tech Stack:** TypeScript, Node test runner, Expo/React Native state modules, npm workspaces.

---

### Task 1: Physical Parsed Payload Equality Proof

**Files:**
- Modify: `apps/mobile/src/state/alertEvidenceState.test.ts`
- Modify: `apps/mobile/src/state/alertEvidenceState.ts`

- [x] **Step 1: Write the failing test**

Add a physical bridge test where raw text, event id, channel id, author id, contract version, source policy, queue proof, and audit proof all pass, but parsed payloads differ:

```ts
assert.equal(summary.modeLabel, "Physical bridge test");
assert.equal(summary.gateLabel, "Blocks test");
assert.equal(summary.contractLabel, "Contract chrome.discord.message.v1");
assert.equal(summary.parserLabel, "Signal/audit parsed payload mismatch");
assert.equal(summary.queueLabel, "Order request queued");
assert.equal(summary.blocking, true);
```

- [x] **Step 2: Run red verification**

Run:

```powershell
npm --workspace @apk-alerts/mobile exec -- tsx --test src/state/alertEvidenceState.test.ts
```

Expected: FAIL because parser proof currently checks parsed payload presence but not physical signal/audit equality.

- [x] **Step 3: Compare canonical parsed payloads**

Add a small canonical JSON helper that sorts object keys recursively. In `buildAlertParserProofSummary`, after presence checks, reject physical parsed payload mismatch:

```ts
if (chain.signal && canonicalJson(chain.signal.parsed) !== canonicalJson(chain.decision.parsed)) {
  return { passed: false, label: "Signal/audit parsed payload mismatch" };
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
git add docs/superpowers/plans/2026-06-27-apk-alerts-mobile-physical-parsed-payload-proof.md apps/mobile/src/state/alertEvidenceState.ts apps/mobile/src/state/alertEvidenceState.test.ts
git diff --cached --check
git commit -m "feat: require physical parsed payload proof"
git push
```

Expected: commit and push succeed after verification.
