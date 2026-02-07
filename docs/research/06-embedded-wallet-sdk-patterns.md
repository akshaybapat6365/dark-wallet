# Embedded Wallet SDK Patterns (Seedless + Midnight)

> Dark Wallet Research Document 06
> Last updated: February 2026

## Embedded Wallet SDK Baselines (What We Learn From)
This document tracks design patterns from popular embedded wallet SDKs and maps them to Midnight's constraints.

## Common Patterns
- **Headless core**: state machine + persistence + eventing, UI kept outside.
- **Provider model**: pluggable storage/crypto/networking.
- **Session permissions**: per-origin scopes, revocation, reconnection.
- **Recovery**: separates "auth" (passkey) from "key material" (chain signing key).

## Seedless v0 (Our Chosen Approach)
For v0, Dark Wallet derives deterministic key material from a passkey extension:
- Preferred: WebAuthn PRF
- Fallback: hmac-secret

This avoids needing an MPC backend to ship the SDK.

## Curve Mismatch Note
Passkeys are typically P-256; Midnight signature/key material may not match. For v0 we use passkeys for deterministic key derivation and encrypting state, not as a direct signing primitive.

## What We Must Expose To DApps
- A stable `ConnectedAPI` analog so dApps can write once and work with:
  - embedded SDK
  - extension injection provider

## References
- Midnight SDK overview: `docs/research/02-midnight-sdk-and-packages.md`
- Compass artifact: `docs/references/compass_artifact_wf-81cb6574-61ca-496f-a203-897a2c9ce14d_text_markdown.md`

