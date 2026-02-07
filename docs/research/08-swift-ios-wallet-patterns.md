# Swift iOS Wallet Patterns (Midnight Constraints)

> Dark Wallet Research Document 08
> Last updated: February 2026

## Secure Enclave Reality
- Secure Enclave supports P-256 ECDSA (CryptoKit), not arbitrary curves like BLS12-381.
- iOS wallet must treat Secure Enclave as a key-wrapping / auth primitive, not necessarily as the chain signing key primitive.

## Storage
- Keychain for encrypted secrets / wrapped key material.
- Data encryption uses AES-GCM with keys gated by biometrics (where appropriate).

## State Management
- Prefer a deterministic architecture (e.g., TCA) for complex wallet state transitions.

## Embedded dApp Browser (Later Phase)
- WKWebView with early injection (`atDocumentStart`) for a mobile dApp connector strategy.

## References
- Midnight docs: https://docs.midnight.network/
- Compass artifact: `docs/references/compass_artifact_wf-81cb6574-61ca-496f-a203-897a2c9ce14d_text_markdown.md`

