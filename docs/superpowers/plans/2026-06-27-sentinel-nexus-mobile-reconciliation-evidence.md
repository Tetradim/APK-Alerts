# Sentinel Nexus Mobile Reconciliation Evidence Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add mobile broker/order/position reconciliation evidence from Sentinel Echo so Positions can prove alert chains reconcile or show unresolved attention.

**Architecture:** Sentinel Nexus will normalize Sentinel Echo `/api/operator/reconciliation` rows into typed alert/trade/order/position chain evidence. The sync client will fetch that endpoint fail-closed. The mobile Positions tab will display only real remote reconciliation rows and summaries; it will not create positions, place orders, or invent demo data.

**Tech Stack:** TypeScript, npm workspaces, Expo Router, React Native, Zustand, Node `tsx --test`, Sentinel Echo `/api/operator/reconciliation`.

---

## File Structure

- Create `packages/contracts/src/reconciliation.ts`
  - Normalize reconciliation rows and summarize unresolved real/simulated attention.
- Create `packages/contracts/src/reconciliation.test.ts`
  - Test reconciled, pending real, simulated unresolved, terminal/no-attention, and malformed rows.
- Modify `packages/contracts/src/index.ts`
  - Export reconciliation contracts.
- Create `packages/sync-client/src/remoteReconciliationClient.ts`
  - Fetch `/api/operator/reconciliation?limit=N`.
- Create `packages/sync-client/src/remoteReconciliationClient.test.ts`
  - Test endpoint URL, API key behavior, and fail-closed failures.
- Modify `packages/sync-client/src/index.ts`
  - Export reconciliation client.
- Create `apps/mobile/src/state/reconciliationState.ts`
  - Store remote reconciliation snapshot and summaries.
- Create `apps/mobile/src/state/reconciliationState.test.ts`
  - Test default, clear, unresolved, and stale connection clearing.
- Create `apps/mobile/src/screens/PositionsScreen.tsx`
  - Replace placeholder with reconciliation evidence.
- Modify `apps/mobile/app/(tabs)/positions.tsx`
  - Render `PositionsScreen`.
- Modify `README.md`
  - Document `/api/operator/reconciliation`.

## Tasks

- [ ] Write failing contract tests and verify red.
- [ ] Implement reconciliation contract normalization and summary.
- [ ] Write failing sync-client tests and verify red.
- [ ] Implement remote reconciliation client.
- [ ] Write failing mobile state tests and verify red.
- [ ] Implement mobile state and Positions UI.
- [ ] Run `npm test`, `npm run typecheck`, `git diff --check`.
- [ ] Commit and push `feat: add mobile reconciliation evidence`.

## Self-Review

- Spec coverage: This batch covers broker order/position reconciliation visibility and supports live-readiness evidence by surfacing unresolved reconciliation items. It does not refresh broker orders, place orders, build OCO exits, or run replay.
- Placeholder scan: The plan is narrow and all tasks are concrete.
- Type consistency: Contract, sync client, state, and UI use `Reconciliation` naming.
