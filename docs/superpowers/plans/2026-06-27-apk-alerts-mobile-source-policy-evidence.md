# Mobile Source Policy Evidence Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make strict source, channel, author, and parser-confidence policy proof inspectable on each mobile alert evidence card.

**Architecture:** The shared bridge alert decision contract already carries source policy proof from Consolidation. Mobile will derive a fail-closed display summary from each alert evidence chain and render the exact policy gate details without changing backend behavior, placing orders, or claiming live-money readiness.

**Tech Stack:** TypeScript, Expo React Native, Zustand, Node test runner.

---

### Task 1: Source Policy Display Summary

**Files:**
- Modify: `apps/mobile/src/state/alertEvidenceState.test.ts`
- Modify: `apps/mobile/src/state/alertEvidenceState.ts`

- [ ] **Step 1: Write failing tests**

Add tests for `buildSourcePolicySummary(chain)` covering:
- accepted source proof with override, parser, channel, author, and metadata checks passed;
- blocked proof with low parser confidence plus blocked channel and author;
- missing decision/source proof blocks by default.

- [ ] **Step 2: Run focused test to verify failure**

Run: `npm --workspace @apk-alerts/mobile exec -- tsx --test src/state/alertEvidenceState.test.ts`

Expected: FAIL because `buildSourcePolicySummary` is not exported yet.

- [ ] **Step 3: Implement minimal summary helper**

Add `SourcePolicyDisplaySummary` and `buildSourcePolicySummary(chain)` to `apps/mobile/src/state/alertEvidenceState.ts`. It should require override match, parser confidence allowed, channel URL allowed, author ID allowed, and metadata policy passed before reporting the source gate clear.

- [ ] **Step 4: Run focused test to verify pass**

Run: `npm --workspace @apk-alerts/mobile exec -- tsx --test src/state/alertEvidenceState.test.ts`

Expected: PASS.

### Task 2: Alerts Card Drill-Down

**Files:**
- Modify: `apps/mobile/src/screens/AlertsScreen.tsx`

- [ ] **Step 1: Render source policy proof lines**

Import `buildSourcePolicySummary` and use it for each alert card. Replace the compact source-proof sentence with status, source identity, parser gate, channel gate, author gate, execution mode, and a source-gate pill.

- [ ] **Step 2: Verify full batch**

Run:

```bash
npm test
npm run typecheck
git diff --check
```

Expected: all commands pass.

- [ ] **Step 3: Commit and push**

Run:

```bash
git add docs/superpowers/plans/2026-06-27-apk-alerts-mobile-source-policy-evidence.md apps/mobile/src/state/alertEvidenceState.ts apps/mobile/src/state/alertEvidenceState.test.ts apps/mobile/src/screens/AlertsScreen.tsx
git commit -m "feat: add mobile source policy evidence"
git push
```
