# Midnight SDK & npm Packages

> **Dark Wallet Research Document 02**
> Last updated: February 2026
> Sources: npmjs.com/@midnight-ntwrk, midnightntwrk/midnight-js GitHub, Midnight docs

---

> Note: upstream package versions move quickly. For the current pinned/verified versions in this repo, see
> `docs/references/version-matrix.md`.

## 1. Midnight.js Framework Overview

Midnight.js is the **primary TypeScript application development framework** — equivalent to Web3.js (Ethereum) or polkadot.js (Polkadot).

```
┌──────────────────────────────────────────────────────────┐
│                    MIDNIGHT.JS v3.0.0                     │
├──────────────────────────────────────────────────────────┤
│                                                          │
│  DApp Code (Your Application)                            │
│    │                                                     │
│    ├── @midnight-ntwrk/midnight-js-contracts             │
│    │     Contract deployment, interaction, state query    │
│    │                                                     │
│    ├── @midnight-ntwrk/compact-runtime                   │
│    │     Runtime primitives for compiled Compact output   │
│    │                                                     │
│    └── Providers (pluggable)                             │
│          ├── ProofProvider (proof server client)          │
│          ├── PublicDataProvider (indexer GraphQL)         │
│          ├── PrivateStateProvider (encrypted local)       │
│          ├── ZkConfigProvider (proving/verifying keys)    │
│          ├── WalletProvider (wallet interaction)          │
│          └── LoggerProvider                              │
│                                                          │
└──────────────────────────────────────────────────────────┘
```

### Key Design Principles

1. **Type-Safety**: Branded types (`HexString`, `ContractAddress`, `BlockHash`), inferred generics, minimal use of `any`
2. **Provider Pattern**: Fully pluggable — swap implementations for different environments (Browser vs Node.js)
3. **Isomorphic**: Designed to work in both browser extensions and server-side Node.js
4. **Contract "Rehearsal"**: DApps execute contract logic locally to generate "unproven transactions," then send to proof server

**Source**: [github.com/midnightntwrk/midnight-js](https://github.com/midnightntwrk/midnight-js) (28 stars, Apache-2.0)

---

## 2. Complete npm Package Inventory

### 2.1 Core Framework

| Package                                  | Version | Purpose                                                    |
| ---------------------------------------- | ------- | ---------------------------------------------------------- |
| `@midnight-ntwrk/midnight-js-*`          | 3.0.0   | Published as a family of packages (no single root package) |
| `@midnight-ntwrk/midnight-js-types`      | 3.0.0   | Shared data types & interfaces for all modules             |
| `@midnight-ntwrk/midnight-js-contracts`  | 3.0.0   | Deployed contract interaction, deployment, state queries   |
| `@midnight-ntwrk/compact-runtime`        | 0.14.0  | Runtime primitives for Compact's TypeScript/JS output      |
| `@midnight-ntwrk/midnight-js-network-id` | 3.0.0   | Network configuration (TestNet/MainNet/Preview/Standalone) |
| `@midnight-ntwrk/midnight-js-utils`      | 3.0.0   | Hex utils, type utils, date utils, assertion utils         |

### 2.2 Providers

| Package                                                            | Purpose                                                   |
| ------------------------------------------------------------------ | --------------------------------------------------------- |
| `@midnight-ntwrk/midnight-js-http-client-proof-provider`           | HTTP client for remote proof server (port 6300)           |
| `@midnight-ntwrk/midnight-js-indexer-public-data-provider`         | GraphQL client for the indexer API                        |
| `@midnight-ntwrk/midnight-js-fetch-zk-config-provider`             | Browser-based ZK artifact (proving/verifying key) fetcher |
| `@midnight-ntwrk/midnight-js-node-zk-config-provider`              | Node.js-based ZK artifact provider                        |
| `@midnight-ntwrk/midnight-js-level-private-state-provider-example` | LevelDB-based encrypted private state storage             |
| `@midnight-ntwrk/midnight-js-logger-provider`                      | Configurable logging provider                             |

### 2.3 Wallet SDK

| Package                              | Version | Purpose                                                          |
| ------------------------------------ | ------- | ---------------------------------------------------------------- |
| `@midnight-ntwrk/wallet`             | 5.0.0   | Full wallet SDK — key management, transactions, dApp interaction |
| `@midnight-ntwrk/wallet-api`         | -       | Wallet API interface definitions                                 |
| `@midnight-ntwrk/wallet-sdk-hd`      | 3.0.0   | HD wallet with BIP-32 derivation (roles for Midnight)            |
| `@midnight-ntwrk/wallet-sdk-address-format` | 3.0.0 | Bech32m address encoding/decoding and formatting               |
| `@midnight-ntwrk/wallet-sdk-facade`  | 1.0.0   | Facade for wallet operations                                     |

### 2.4 Protocol & Ledger

| Package                              | Version | Purpose                                                |
| ------------------------------------ | ------- | ------------------------------------------------------ |
| `@midnight-ntwrk/ledger-v7`          | 7.0.0   | Core ledger primitives and WASM bindings               |
| `@midnight-ntwrk/onchain-runtime-v2` | 2.0.0   | On-chain runtime execution                             |
| `@midnight-ntwrk/zswap`              | -       | Zswap protocol for shielded transfers and atomic swaps |

### 2.5 DApp Integration

| Package                              | Version | Purpose                                               |
| ------------------------------------ | ------- | ----------------------------------------------------- |
| `@midnight-ntwrk/dapp-connector-api` | 4.0.0   | Wallet-DApp communication (window.midnight injection) |

---

## 3. Wallet SDK Architecture (v5.0.0)

The `midnight-wallet` repository reveals a sophisticated architecture built on **Effect-TS**:

### 3.1 Key Characteristics

- **Effect-TS**: Pervasive use of `Effect.gen`, `Brand`, `Schema` for type-safe error handling
- **BLoC Pattern**: Modular state management using incremental block processing
- **Service-Oriented**: Clean separation between `indexer-client`, `node-client`, `prover-client`
- **WASM Proving**: Integrates WASM-based provers for local proof generation
- **Encrypted Private State**: AES-256-GCM encryption at rest, keyed from wallet seed

### 3.2 HD Wallet Creation

```typescript
import {
  generateRandomSeed,
  HDWallet,
  Roles,
} from "@midnight-ntwrk/wallet-sdk-hd";

const seed = generateRandomSeed();
const wallet = HDWallet.fromSeed(seed);

if (wallet.type === "seedOk") {
  // Derive Zswap key for shielded operations
  const zswapKey = wallet.hdWallet
    .selectAccount(0)
    .selectRole(Roles.Zswap)
    .deriveKeyAt(0);
}
```

### 3.3 Address Format

Midnight uses **Bech32m encoding** with network-specific prefixes:

| Network | Unshielded Prefix     | Shielded Prefix              |
| ------- | --------------------- | ---------------------------- |
| Mainnet | `mn_addr_...`         | `mn_shield-addr_...`         |
| Preprod | `mn_addr_preprod1...` | `mn_shield-addr_preprod1...` |
| Testnet | `mn_addr_test1...`    | `mn_shield-addr_test1...`    |

**Critical privacy property**: A DUST address is **non-derivable** from the NIGHT address that generated it. Even if a NIGHT address is known publicly, the shielded DUST address remains unlinkable.

---

## 4. Midnight.js Monorepo Structure

```
midnight-js/
├── packages/
│   ├── compact/           # Compact compiler integration
│   ├── contracts/         # Contract deployment & interaction
│   │   ├── call-constructor.ts
│   │   ├── call.ts
│   │   ├── deploy-contract.ts
│   │   ├── find-deployed-contract.ts
│   │   ├── submit-call-tx.ts
│   │   ├── submit-deploy-tx.ts
│   │   ├── transaction.ts
│   │   └── tx-model.ts
│   ├── fetch-zk-config-provider/
│   ├── http-client-proof-provider/
│   ├── indexer-public-data-provider/
│   │   └── schema.graphql     # GraphQL schema for indexer
│   ├── level-private-state-provider-example/
│   │   └── storage-encryption.ts  # AES-256-GCM encryption
│   ├── logger-provider/
│   ├── network-id/
│   ├── node-zk-config-provider/
│   ├── types/
│   │   ├── contract.ts
│   │   ├── midnight-types.ts
│   │   ├── proof-provider.ts
│   │   ├── wallet-provider.ts
│   │   └── zk-config-provider.ts
│   └── utils/
│       ├── hex-utils.ts
│       └── type-utils.ts
├── testkit-js/
├── package.json           # Node >=22, Yarn 4.12.0, Turbo
└── tsconfig.base.json
```

### Build System

- **Package manager**: Yarn 4.12.0 (Berry)
- **Monorepo tool**: Turborepo
- **Node requirement**: >=22
- **TypeScript**: 5.8.2+
- **Test framework**: Vitest 4.0+
- **Bundler**: Rollup
- **Linting**: ESLint 9 with Prettier
- **Effect-TS**: 3.19.15 (pinned via resolutions)

---

## 5. Community SDK: MeshJS/midnight

MeshJS provides a community-driven SDK layer on top of the official packages:

| Package                   | Purpose                                        |
| ------------------------- | ---------------------------------------------- |
| `@meshsdk/midnight-setup` | Pre-built smart contract + API + code snippets |
| `create-midnight-app`     | CLI scaffolding tool                           |
| React hooks               | Wallet integration hooks for React apps        |

**Source**: [github.com/MeshJS/midnight](https://github.com/MeshJS/midnight)

---

## 6. Key Patterns for Dark Wallet

### 6.1 What Dark Wallet Must Implement

As a wallet, Dark Wallet needs to provide implementations for several Midnight.js provider interfaces:

1. **WalletProvider**: Key management, balance queries, transaction signing
2. **ProofProvider**: Either delegate to proof server or implement client-side proving
3. **PrivateStateProvider**: Encrypted storage of user's private contract state
4. **DApp Connector API**: Inject `window.midnight.darkwallet` for dApp communication

### 6.2 What Dark Wallet Can Reuse

- `@midnight-ntwrk/wallet` (v5.0.0): Core wallet logic
- `@midnight-ntwrk/wallet-sdk-hd` (v3.0.0): HD derivation
- `@midnight-ntwrk/wallet-sdk-address-format` (v3.0.0): Address encoding/decoding
- `@midnight-ntwrk/compact-runtime` (v0.14.0): Contract execution
- `@midnight-ntwrk/ledger-v7` (v7.0.0): Ledger primitives
- `@midnight-ntwrk/dapp-connector-api` (v4.0.0): Connector type definitions

---

## References

1. Midnight.js README. [github.com/midnightntwrk/midnight-js](https://github.com/midnightntwrk/midnight-js)
2. `@midnight-ntwrk/wallet` npm page. [npmjs.com/package/@midnight-ntwrk/wallet](https://www.npmjs.com/package/@midnight-ntwrk/wallet)
3. Midnight Docs. _SDKs_. [docs.midnight.network/sdks](https://docs.midnight.network/sdks)
4. Midnight Docs. _Wallet SDK Release Notes_. [docs.midnight.network/relnotes/wallet](https://docs.midnight.network/relnotes/wallet)
