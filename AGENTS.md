# Dark Wallet: Agent Instructions

## Scope
- Midnight-native wallet project.
- Primary public deliverable: `packages/sdk` (`@dark-wallet/sdk`).

## Repo Commands
```bash
corepack enable
pnpm i
pnpm lint
pnpm typecheck
pnpm test
pnpm build
```

## WSL Windows Path Translation
If given a Windows path (`C:\\...` or `C:/...`), translate to `/mnt/c/...` before reading.

## Security Rules
- Never log or persist raw key material, derived secrets, PRF outputs, or decrypted private state.
- Everything persisted must be encrypted at rest (AES-256-GCM).
- No secrets in git: `.env*` is ignored.

## API Compatibility
- Extension provider must follow `@midnight-ntwrk/dapp-connector-api` v4.0.0 injection model (`window.midnight[uuid]`).
- Embedded SDK exposes a programmatic equivalent of `ConnectedAPI`.
- Transaction strings in the connector surface are `hex(Transaction.serialize())` (not `Transaction.toString()`).

## Coding Standards
- Strict TypeScript; avoid `any` in the SDK public surface.
- Side effects behind interfaces (`StorageProvider`, `KeyMaterialProvider`, `CryptoProvider`).

## Testing Minimum
- Any bugfix needs a regression test in `packages/sdk`.
