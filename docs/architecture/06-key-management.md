# Key Management

## v0 (Seedless)
- Use passkey-derived secret (WebAuthn PRF or hmac-secret) as root key material.
- HKDF derives:
  - `masterSeed` (wallet derivation input)
  - `storageKey` (AES-256-GCM for encrypted persistence)

## Recovery (v0)
- Recovery requires the same passkey to be available again.
- If passkey is lost, wallet is not recoverable in v0.

## v1 (Planned)
- Optional MPC/social recovery as additional key material provider.

