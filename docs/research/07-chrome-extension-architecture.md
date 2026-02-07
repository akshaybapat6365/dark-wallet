# Chrome Extension Architecture (MV3 Wallet)

> Dark Wallet Research Document 07
> Last updated: February 2026

## Goal
Implement Midnight dApp Connector API v3.0.0 as a secure MV3 wallet provider.

## Injection Model
- Create `window.midnight` as non-writable/non-configurable if not present.
- Register wallet under a fresh UUIDv4 key (`window.midnight[uuid] = InitialAPI`).
- Freeze all API objects.

## MV3 Constraints
- Service worker can be terminated frequently.
- Long operations should not rely on long-lived JS heap state.
- Persist state in IndexedDB, rehydrate on demand.

## Messaging Topology
- Inpage script (MAIN world): exposes API, forwards requests.
- Content script: bridge + origin isolation.
- Service worker: approvals, signing, persistence, network IO.

## References
- `docs/research/03-dapp-connector-api-spec.md`
- Midnight dApp connector repo: https://github.com/midnightntwrk/midnight-dapp-connector-api

