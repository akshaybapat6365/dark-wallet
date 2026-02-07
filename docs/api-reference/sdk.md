# `@dark-wallet/sdk` API Reference (v0)

Status: **early**, but the SDK now implements the **`@midnight-ntwrk/dapp-connector-api@4.0.0`** surface programmatically.

## Install (workspace)
```bash
pnpm --filter @dark-wallet/sdk build
```

## Usage

### Create wallet (headless)
```ts
import { createDarkWallet, StaticKeyMaterialProvider } from "@dark-wallet/sdk";

const wallet = createDarkWallet({
  keyMaterial: new StaticKeyMaterialProvider(new Uint8Array(32).fill(1)),
  origin: "https://dapp.example", // optional, used for permission scoping + signData prefixing
  endpoints: {
    networkId: "testnet",
    indexerUri: "http://127.0.0.1:8088/api/v1/graphql",
    indexerWsUri: "ws://127.0.0.1:8088/api/v1/graphql",
    proverServerUri: "http://127.0.0.1:6300",
    substrateNodeUri: "wss://rpc.testnet-02.midnight.network",
  },
});

const api = await wallet.connect("testnet");
const cfg = await api.getConfiguration();
```

### Make A Transfer
```ts
import { nativeToken } from "@midnight-ntwrk/ledger-v7";

const { tx } = await api.makeTransfer([
  {
    kind: "unshielded",
    type: nativeToken().raw,
    value: 10_000_000n,
    recipient: "mn_addr1...",
  },
]);

await api.submitTransaction(tx);
```

### Transaction Encoding (Important)
All connector methods that accept/return a `tx: string` use:
- `hex(Transaction.serialize())` (not `Transaction.toString()`).

### Passkey-derived key material (browser)
```ts
import { WebAuthnKeyMaterialProvider } from "@dark-wallet/sdk";

const keyMaterial = new WebAuthnKeyMaterialProvider({
  credentialId: "<base64 rawId>",
  mode: "prf", // fallback: "hmac-secret"
});
```

### Permissions
The SDK supports a pluggable permission controller. The embedded default is allow-all.

## Errors
- `DarkWalletError`
  - `ERR_INVALID_CONFIG`
  - `ERR_UNSUPPORTED`
  - `ERR_CRYPTO`
  - `ERR_STORAGE`

- Connector-facing methods may throw a `DAppConnectorAPIError` compatible with `@midnight-ntwrk/dapp-connector-api`:
  - `error.type === "DAppConnectorAPIError"`
  - `error.code` in: `InternalError | Rejected | InvalidRequest | PermissionRejected | Disconnected`
