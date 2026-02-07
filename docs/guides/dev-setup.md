# Dev Setup

## Requirements
- Node `>=22`
- pnpm via Corepack

## Install
```bash
corepack enable
pnpm i
```

## Verify
```bash
pnpm lint
pnpm typecheck
pnpm test
pnpm build
```

## Integration Tests (Optional, Env-Gated)

The repo ships with offline-safe unit tests by default.

Integration tests run only when their env vars are present (they are skipped in CI unless you set them).

### Required Env
- `DARKWALLET_IT_NETWORK_ID` (example: `testnet`)
- `DARKWALLET_IT_INDEXER_URI` (example: `http://127.0.0.1:8088/api/v1/graphql`)
- `DARKWALLET_IT_SUBSTRATE_NODE_URI` (example: `wss://rpc.testnet-02.midnight.network`)

### Optional Env
- `DARKWALLET_IT_INDEXER_WS_URI` (example: `ws://127.0.0.1:8088/api/v1/graphql`)
- `DARKWALLET_IT_PROVER_SERVER_URI` (example: `http://127.0.0.1:6300`)

### Run
```bash
pnpm --filter @dark-wallet/sdk test
```
