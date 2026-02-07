# Dark Wallet

Midnight-native wallet surfaces with a shared core. Current focus: **`@dark-wallet/sdk`** (embedded/headless SDK).

## Workspace

### Requirements
- Node `>=22`
- pnpm (via Corepack)

### Commands
```bash
corepack enable
pnpm i
pnpm lint
pnpm typecheck
pnpm test
pnpm build
```

## Packages
- `packages/sdk` — `@dark-wallet/sdk` (public, open-source)
- `packages/extension` — Chrome MV3 extension scaffold (connector injection + RPC skeleton)

## Docs
See `docs/README.md`.
