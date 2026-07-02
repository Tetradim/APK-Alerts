# Mobile Alert Test Evidence Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make silent and physical alert test evidence explicit on each mobile alert card.

**Architecture:** Sentinel Nexus already mirrors bridge signal events and audited decision events from Sentinel Echo. Mobile will derive a read-only test-evidence summary per alert chain that distinguishes physical bridge observation from silent audit-only proof, then reports parse, source, queue, audit, and capture evidence. This batch must not claim that a live physical test occurred unless the remote evidence contains bridge observation proof.

**Tech Stack:** TypeScript, Expo React Native, Zustand, Node test runner.

---

### Task 1: Alert Test Evidence Summary

**Files:**
- Modify: `apps/mobile/src/state/alertEvidenceState.test.ts`
- Modify: `apps/mobile/src/state/alertEvidenceState.ts`

- [x] **Step 1: Write failing tests**

Add tests for `buildAlertTestEvidenceSummary(chain)` covering:
- complete physical bridge proof with signal, audit decision, parser proof, source proof, queue proof, and capture/message evidence;
- complete silent audit-only proof with decision but no bridge signal;
- physical bridge observation missing audit decision blocks;
- missing chain blocks and reports no test evidence.

- [x] **Step 2: Run focused test to verify failure**

Run: `npm --workspace @sentinel-nexus/mobile exec -- tsx --test src/state/alertEvidenceState.test.ts`

Expected: FAIL because `buildAlertTestEvidenceSummary` is not exported yet.

- [x] **Step 3: Implement minimal summary helper**

Add `AlertTestEvidenceSummary` and `buildAlertTestEvidenceSummary(chain)` to `apps/mobile/src/state/alertEvidenceState.ts`. Reuse the existing source-policy and queue/place summaries; require parser confidence, source proof, queue proof, and audit ID for a clear test gate. Physical mode additionally requires signal evidence; silent mode is labeled audit-only.

- [x] **Step 4: Run focused test to verify pass**

Run: `npm --workspace @sentinel-nexus/mobile exec -- tsx --test src/state/alertEvidenceState.test.ts`

Expected: PASS.

### Task 2: Alerts Card Test Evidence Panel

**Files:**
- Modify: `apps/mobile/src/screens/AlertsScreen.tsx`

- [x] **Step 1: Render silent/physical test evidence**

Import `buildAlertTestEvidenceSummary` and render mode, parser, source, queue, audit, capture, and a clear/blocking status pill on each alert card.

- [x] **Step 2: Verify full batch**

Run:

```bash
npm test
npm run typecheck
git diff --check
```

Expected: all commands pass.

- [x] **Step 3: Commit and push**

Run:

```bash
git add docs/superpowers/plans/2026-06-27-sentinel-nexus-mobile-alert-test-evidence.md apps/mobile/src/state/alertEvidenceState.ts apps/mobile/src/state/alertEvidenceState.test.ts apps/mobile/src/screens/AlertsScreen.tsx
git commit -m "feat: add mobile alert test evidence"
git push
```
