# APK Alerts Mobile Alert Contract Proof Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make alert test evidence fail closed unless audited alerts carry a stable event id and the expected Chrome Discord message contract version.

**Architecture:** Keep normalized bridge evidence in `@apk-alerts/contracts` as the source. Add a mobile summary gate that inspects the chain's signal/audit contract fields, exposes a `contractLabel`, and blocks test clearance when identity or contract proof is missing or wrong.

**Tech Stack:** TypeScript, Node test runner, Expo/React Native state modules, npm workspaces.

---

### Task 1: Alert Test Contract Proof

**Files:**
- Modify: `apps/mobile/src/state/alertEvidenceState.test.ts`
- Modify: `apps/mobile/src/state/alertEvidenceState.ts`
- Modify: `apps/mobile/src/screens/AlertsScreen.tsx`

- [x] **Step 1: Write the failing tests**

Add assertions that passing physical and silent test summaries expose `Contract chrome.discord.message.v1`. Add a regression test with two otherwise queued audit decisions: one missing `event_id`, one with an old `contract_version`. Each must return `gateLabel: "Blocks test"`, `blocking: true`, and a specific `contractLabel`.

- [x] **Step 2: Run red verification**

Run: `npm --workspace @apk-alerts/mobile exec -- tsx --test src/state/alertEvidenceState.test.ts`

Expected: FAIL because the summary does not yet expose or enforce `contractLabel`.

- [x] **Step 3: Add contract proof gate**

Add `contractLabel` to `AlertTestEvidenceSummary`. Compute a proof that requires:
- an audited decision
- non-empty audited `eventId`
- audited `contractVersion === CHROME_DISCORD_MESSAGE_CONTRACT_VERSION`
- if a physical signal exists, non-empty signal `eventId`, matching signal/audit event ids, and matching signal contract version

Include the contract proof in the `clear` boolean.

- [x] **Step 4: Render contract proof**

Add `{alertTest.contractLabel}` to the Alerts screen's alert-test evidence block.

- [x] **Step 5: Run green verification**

Run: `npm --workspace @apk-alerts/mobile exec -- tsx --test src/state/alertEvidenceState.test.ts`

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
git add docs/superpowers/plans/2026-06-27-apk-alerts-mobile-alert-contract-proof.md apps/mobile/src/state/alertEvidenceState.ts apps/mobile/src/state/alertEvidenceState.test.ts apps/mobile/src/screens/AlertsScreen.tsx
git diff --cached --check
git commit -m "feat: require alert contract proof"
git push
```

Expected: commit and push succeed after verification.
