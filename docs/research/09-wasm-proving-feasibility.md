# WASM Proving Feasibility (Halo2/Midnight)

> Dark Wallet Research Document 09
> Last updated: February 2026

## Context
Proof generation is expensive. For user-facing wallets:
- browser CPU/memory constraints matter
- extension service worker lifetime constraints matter
- mobile constraints matter even more

## v0 Strategy
- Default to a proof server (`proverServerUri`).
- Keep SDK interfaces compatible with future in-browser proving (workers, WASM, WebGPU).

## References
- Midnight ZK: https://github.com/midnightntwrk/midnight-zk
- Halo2: https://github.com/zcash/halo2

