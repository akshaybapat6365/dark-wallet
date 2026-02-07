# ZK Cryptography Papers (Midnight-Relevant)

> Dark Wallet Research Document 05
> Last updated: February 2026

## Protocols and Components Mentioned In Midnight Research

### Kachina
Private smart contracts design basis in Midnight materials.
- Paper: https://eprint.iacr.org/2020/543

### Zswap
Confidential atomic swaps; basis for shielded asset transfers.
- Paper: https://eprint.iacr.org/2022/1002

### Halo2
PLONKish proving system used (with Midnight modifications).
- Reference implementation: https://github.com/zcash/halo2

### BLS12-381
Pairing-friendly curve used widely across ZK ecosystems.

## Dark Wallet Implications
- SDK architecture must assume proof generation is expensive and asynchronous.
- Extension/service-worker constraints mean: proving likely happens via proof server or offscreen documents.
- Mobile constraints (memory/cpu) mean remote proving needs to be a first-class option even if local proving exists.

## References
- Midnight ZK repo: https://github.com/midnightntwrk/midnight-zk
- Kachina: https://eprint.iacr.org/2020/543
- Zswap: https://eprint.iacr.org/2022/1002
- Halo2: https://github.com/zcash/halo2

