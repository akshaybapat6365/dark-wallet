# ADR-003: MV3 Extension Uses An Offscreen Document As The Wallet Host

Status: Accepted  
Date: 2026-02-07

## Context
Chrome MV3 service workers are not a stable environment for long-running work:
- They can be suspended when idle.
- They have strict lifetime expectations.

Wallet operations (sync, proving coordination, indexing, transaction orchestration) are inherently long-lived and stateful.

## Decision
The extension architecture is:
- **Service worker**: lifecycle manager + RPC router.
- **Offscreen document**: the long-running wallet host process that owns the SDK instance(s), persistence, and permission gating.

## Consequences
- We avoid fighting SW suspension semantics.
- State lives in IndexedDB in the offscreen context (encrypted at rest).
- The SW can be restarted and rehydrate the offscreen host on demand.

