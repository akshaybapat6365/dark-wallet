# Compact Language Reference (Practical)

> Dark Wallet Research Document 04
> Last updated: February 2026
> Primary reference: `docs/references/compass_artifact_wf-81cb6574-61ca-496f-a203-897a2c9ce14d_text_markdown.md`

## What Compact Is
Compact (open-sourced as "Minokawa") is Midnight's statically typed, TypeScript-like language for writing zero-knowledge smart contracts.

## Execution Contexts
Compact contracts span three distinct contexts:

1. **Ledger**
   - Public, on-chain state.
   - Example types: `Counter`, `Uint<128>`, `Bytes<32>`.
2. **Circuit**
   - Off-chain logic that generates ZK proofs.
   - `export circuit` functions are compiled to circuits.
3. **Witness**
   - Private inputs known only to the executing entity.
   - Implemented off-chain in TypeScript.

## Core Privacy Boundary: `disclose()`
`disclose()` explicitly moves values from private/circuit context into public ledger context.

## Types and Standard Library (High Level)
Common types:
- `Uint<N>`, `Bytes<N>`, `Field`, `Boolean`, `Counter`, `Vector`, enums, structs

Common stdlib primitives:
- hashing and commitments (`persistentHash`, `transientHash`, commits)
- elliptic curve ops (`ecAdd`, `ecMul`, `hashToCurve`)

## Current Limitations (Operational)
- No unbounded loops (bounded computation only).
- Cross-contract calls not available yet (`contract` keyword reserved).
- Toolchain still evolving; expect version churn.

## Implications For Dark Wallet
- Wallet must support running "rehearsal" logic and then proving through a proof server (v0).
- UX should treat Compact as an implementation detail: users shouldn't see circuit/witness/ledger concepts.
- DApp connector surface must allow dApps to request wallet-balanced transactions without exposing UTxO internals.

## References
- Midnight docs: https://docs.midnight.network/
- Compass artifact: `docs/references/compass_artifact_wf-81cb6574-61ca-496f-a203-897a2c9ce14d_text_markdown.md`

