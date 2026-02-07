# System Overview

## Goal
Deliver a Midnight-native wallet with four surfaces, sharing a common core.

## Surfaces
1. `@dark-wallet/sdk` (embedded/headless; open-source)
2. Web App (UI)
3. Chrome Extension (MV3; provider injection)
4. iOS (Swift native)

## Shared Core (SDK-first)
- Key material derivation (passkey-derived secret)
- Encrypted private state persistence
- Provider abstraction for networking/proving
- `ConnectedAPI` compatibility surface (mirrors dApp Connector API)

## Non-goals (v0)
- MPC backend
- In-browser proving (default is proof server)
- App store / extension store publishing flow

