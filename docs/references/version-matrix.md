# Version Matrix (Source Of Truth)

This project depends on a moving upstream (Midnight ecosystem). This document tracks:
- what upstream currently publishes,
- what Dark Wallet pins,
- and where our docs/specs may be stale.

Last updated: 2026-02-07

## Connector API

| Component | Docs currently mention | npm latest (this env) | Dark Wallet target |
| --- | --- | --- | --- |
| `@midnight-ntwrk/dapp-connector-api` | `3.0.0` | `4.0.0` | **`4.0.0`** |

Notes:
- v4 changes include: `hintUsage`, `getConnectionStatus`, `DesiredInput/DesiredOutput` shapes, `signData` shapes, and `getDustBalance` shape.

## Wallet SDK

| Component | Docs currently mention | npm latest (this env) | Dark Wallet target |
| --- | --- | --- | --- |
| `@midnight-ntwrk/wallet` | `5.0.0` | `5.0.0` | **`5.0.0`** |
| `@midnight-ntwrk/wallet-api` | (not pinned) | `5.0.0` | transitively pinned via wallet |
| `@midnight-ntwrk/wallet-sdk-hd` | `2.0.0` | `3.0.0` | **`3.0.0`** |
| `@midnight-ntwrk/wallet-sdk-address-format` | (stale doc name) | `3.0.0` | **`3.0.0`** |
| `@midnight-ntwrk/wallet-sdk-facade` | `1.0.0` | `1.0.0` | **`1.0.0`** |
| `@midnight-ntwrk/wallet-sdk-shielded` | `1.0.0` | `1.0.0` | **`1.0.0`** |
| `@midnight-ntwrk/wallet-sdk-unshielded-wallet` | `1.0.0` | `1.0.0` | **`1.0.0`** |
| `@midnight-ntwrk/wallet-sdk-dust-wallet` | `1.0.0` | `1.0.0` | **`1.0.0`** |

## Ledger / Runtime

| Component | Docs currently mention | npm latest (this env) | Dark Wallet target |
| --- | --- | --- | --- |
| `@midnight-ntwrk/ledger-v7` | `7.0.0` | `7.0.1` | **`7.0.0`** (required by `wallet-sdk-facade@1.0.0`) |
| `@midnight-ntwrk/compact-runtime` | `0.14.0` | `0.14.0` | **`0.14.0`** |

## Midnight.js

Our docs mention a single `@midnight-ntwrk/midnight-js` package. In this environment it does not appear published as one package; instead, multiple `@midnight-ntwrk/midnight-js-*` packages exist (e.g. `@midnight-ntwrk/midnight-js-types`, `@midnight-ntwrk/midnight-js-contracts`, providers, etc.).

For `getProvingProvider`, Dark Wallet uses:
- `@midnight-ntwrk/midnight-js-http-client-proof-provider@3.0.0` (HTTP ProvingProvider over `/check` + `/prove`)
- `@midnight-ntwrk/midnight-js-types@3.0.0` (ZKConfigProvider / ZKConfig types)
