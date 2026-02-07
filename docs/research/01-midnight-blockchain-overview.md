# Midnight Blockchain: Architecture and Privacy Model

> **Dark Wallet Research Document 01**
> Last updated: February 2026
> Sources: Midnight official docs, IOG research papers, midnightntwrk GitHub

---

## 1. What Is Midnight?

Midnight is **Cardano's first partner chain** — an independent Layer 1 blockchain built on **Substrate (Polkadot SDK)** using IOG's Cardano PartnerChain Framework. It runs its own consensus, tokenomics, and execution environment while leveraging Cardano's Proof-of-Stake infrastructure for security.

- **Substrate-based**: Uses 6 custom runtime pallets in the `midnight-node` Rust codebase
- **Independent consensus**: Not a sidechain; runs its own block production
- **Cardano SPO integration**: Cardano stake pool operators can produce Midnight blocks and earn NIGHT rewards
- **Block time**: ~6 seconds

**Source**: [docs.midnight.network](https://docs.midnight.network/), [github.com/midnightntwrk/midnight-node](https://github.com/midnightntwrk/midnight-node)

---

## 2. Zero-Knowledge Proof System

### 2.1 Halo2 Framework

Midnight uses **zk-SNARKs via a modified Halo2 proving framework** (PLONK-derived, originally developed by Electric Coin Company for Zcash).

| Property             | Detail                                                                                 |
| -------------------- | -------------------------------------------------------------------------------------- |
| **Proof system**     | PLONKish arithmetization with custom gates                                             |
| **Curve**            | BLS12-381 (migrated from Pluto-Eris in May 2025)                                       |
| **Trusted setup**    | None required (uses KZG commitments)                                                   |
| **Recursive proofs** | Supported via Galois Inc. collaboration                                                |
| **Implementation**   | Forked and diverged from `zcash/halo2` and `privacy-scaling-explorations/halo2` v0.3.0 |

The `midnight-zk` repository (Rust) contains:

- `curves/`: BLS12-381 and JubJub elliptic curve implementations (originally forked from `blstrs` and `zcash/jubjub`)
- `proof-system/`: PLONK proof system using KZG commitments (originally forked from `halo2` v0.3.0)
- `circuits/`: Tooling for constructing ZK circuits
- `aggregator/`: Toolkit for proof aggregation

**Source**: [github.com/midnightntwrk/midnight-zk](https://github.com/midnightntwrk/midnight-zk)

### 2.2 Why BLS12-381?

The transition from Pluto-Eris to BLS12-381 was driven by:

1. **Better proving efficiency**: BLS12-381 has highly optimized implementations across languages
2. **Cross-chain interoperability**: Same curve used by Ethereum (Beacon Chain), Zcash, and Cardano
3. **Halo2-Plutus Verifier**: Enables bridging Halo2 proof verification with Cardano's Plutus smart contracts
4. **~128-bit security level**: Industry-standard pairing-friendly curve

### 2.3 Recursive Proofs

Midnight supports recursive proofs through a collaboration with **Galois Inc.**:

- Proofs can verify other proofs ("ZK Rollup-style" nesting)
- Block proofs can be "folded" into a single blockchain state proof
- Light clients only need to verify one proof to validate the entire chain history
- Critical for scalability as transaction volume grows

**Source**: [galois.com/articles/midnight-and-halo2-zk-rollups-for-secure-scalability](https://www.galois.com/articles/midnight-and-halo2-zk-rollups-for-secure-scalability)

---

## 3. Dual-Ledger Privacy Model

Midnight maintains **two parallel states** on the same chain:

```
┌─────────────────────────────────────────────┐
│              MIDNIGHT LEDGER                │
├──────────────────┬──────────────────────────┤
│  UNSHIELDED      │  SHIELDED               │
│  (Public)        │  (Private)              │
│                  │                          │
│  - Transparent   │  - Encrypted state      │
│  - Auditable     │  - ZK proof verified    │
│  - NIGHT tokens  │  - DUST transactions    │
│  - UTxO-based    │  - Nullifier-based      │
│                  │                          │
│  disclose() ────►│  Default: private       │
│  (opt-in only)   │  (never leaves device)  │
└──────────────────┴──────────────────────────┘
```

### Key Design Principles

1. **Privacy is the default**: All witness data is private unless explicitly disclosed
2. **Selective disclosure via `disclose()`**: The Compact compiler's "Witness Protection Program" (abstract interpreter) prevents accidental data leaks
3. **Private inputs never leave the user's machine**: A local proof server generates ZK proofs client-side
4. **"Rational privacy"**: Users can prove compliance, identity, or eligibility via ZKPs without revealing underlying data

---

## 4. Token Model

### 4.1 NIGHT Token

| Property           | Detail                                                                                                     |
| ------------------ | ---------------------------------------------------------------------------------------------------------- |
| **Type**           | Native governance/utility token                                                                            |
| **Supply**         | Fixed 24 billion (subunit: 1 NIGHT = 1,000,000 STAR)                                                       |
| **Nature**         | **Non-expendable** — never spent on transactions or burned                                                 |
| **Dual existence** | Native on both Cardano and Midnight simultaneously                                                         |
| **Launch**         | December 4, 2025                                                                                           |
| **Exchanges**      | Kraken, OKX, Bybit, KuCoin, Gate, MEXC                                                                     |
| **Distribution**   | "Glacier Drop" airdrop — 4.5B tokens to 8M+ wallets across ADA, BTC, ETH, SOL, XRP, BNB, AVAX, BAT holders |

Protocol-level mechanisms prevent value duplication: tokens unlocked on one chain are locked on the other.

### 4.2 DUST Token

DUST is fundamentally different from any other blockchain "gas" token:

| Property            | Detail                                                                  |
| ------------------- | ----------------------------------------------------------------------- |
| **Nature**          | Shielded, non-transferable, decaying capacity resource                  |
| **Generation**      | Automatically generated by holding NIGHT tokens                         |
| **Decay**           | Unused DUST decays over time (prevents hoarding/spam)                   |
| **Transferability** | Cannot be sent between wallets (but can be delegated)                   |
| **Privacy**         | Using DUST hides wallet addresses and transaction metadata              |
| **Sponsorship**     | dApps can sponsor DUST for users via Babel Station third-party gateways |
| **Testnet**         | Free tDUST available from faucet at midnight.network/test-faucet        |

**Critical implication for Dark Wallet**: Users don't need to hold NIGHT to transact if a dApp sponsors their DUST. The wallet must handle DUST delegation, generation tracking, and balance display.

---

## 5. Network Endpoints

### Testnet (Current)

| Service              | Endpoint                                                       |
| -------------------- | -------------------------------------------------------------- |
| **RPC (WebSocket)**  | `wss://rpc.testnet-02.midnight.network` (Substrate-compatible) |
| **RPC (Ankr)**       | `https://rpc.ankr.com/midnight_testnet/`                       |
| **Indexer GraphQL**  | `http://127.0.0.1:8088/api/v1/graphql` (local)                 |
| **Proof Server**     | `http://localhost:6300` (Docker, local)                        |
| **Faucet (Preprod)** | `https://faucet.preprod.midnight.network`                      |

### Network IDs

| Network            | ID           |
| ------------------ | ------------ |
| Mainnet            | `mainnet`    |
| Preprod            | `preprod`    |
| Preview            | `preview`    |
| Standalone (local) | `standalone` |

---

## 6. Rollout Phases

| Phase      | Timeline | Status      | Key Milestones                                       |
| ---------- | -------- | ----------- | ---------------------------------------------------- |
| **Hilo**   | Dec 2025 | Completed   | NIGHT token launch, exchange listings                |
| **Kukolu** | Q1 2026  | **Current** | Federated mainnet, 100+ ecosystem partners           |
| **Mohalu** | Q2 2026  | Upcoming    | Incentivized testnet, SPO validation, DUST exchange  |
| **Hua**    | Q3 2026  | Upcoming    | Full decentralization, bridging, cross-chain interop |

---

## 7. Cardano Bridge & Interoperability

- **Wanchain**: Developing decentralized cross-chain bridge with ZKP relayer (Catalyst Fund 13)
- **Halo2-Plutus Verifier**: Open-source bridge between Halo2 proof verification and Plutus smart contracts
- **Proposed CIP**: Multi-scalar multiplication (MSM) over BLS12-381 for optimized verifier performance
- **Full bridging**: Scheduled for Hua phase (Q3 2026)

---

## References

1. Midnight Documentation. (2026). _What is Midnight?_ [docs.midnight.network](https://docs.midnight.network/)
2. Midnight GitHub. `midnightntwrk/midnight-node` — Substrate-based blockchain node. [github.com/midnightntwrk/midnight-node](https://github.com/midnightntwrk/midnight-node)
3. Midnight GitHub. `midnightntwrk/midnight-zk` — Zero-knowledge proving system. [github.com/midnightntwrk/midnight-zk](https://github.com/midnightntwrk/midnight-zk)
4. Electric Coin Company. (2020). _Explaining Halo 2_. [electriccoin.co/blog/explaining-halo-2](https://electriccoin.co/blog/explaining-halo-2/)
5. Galois Inc. _Midnight and Halo2: ZK Rollups for Secure Scalability_. [galois.com](https://www.galois.com/articles/midnight-and-halo2-zk-rollups-for-secure-scalability)
