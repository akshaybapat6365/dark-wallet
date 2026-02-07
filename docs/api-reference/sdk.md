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
  endpoints: {
    networkId: "testnet",
    indexerUri: "http://127.0.0.1:8088/api/v1/graphql",
    indexerWsUri: "ws://127.0.0.1:8088/api/v1/graphql",
    proverServerUri: "http://127.0.0.1:6300",
    substrateNodeUri: "wss://rpc.testnet-02.midnight.network",
  },
});

// Optional origin override for permission scoping + `signData` domain separation.
const api = await wallet.connect("testnet", { origin: "https://dapp.example" });
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

### `makeIntent` Segment IDs
`makeIntent(..., { intentId })` supports:
- `intentId: "random"` (random segment id)
- `intentId: number` (must be an integer in `1..65535`)

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

### Encrypted Backup (EPSB)
The SDK can export/import an **encrypted backup** of the encrypted private state blob:
- `wallet.exportEncryptedBackup(password: string): Promise<string>`
- `wallet.importEncryptedBackup(password: string, backupJson: string): Promise<void>`

Notes:
- The backup contains **no plaintext state**.
- Restoring still requires the same key material (e.g. the same passkey) to decrypt the imported state.

## Errors
- `DarkWalletError`
  - `ERR_INVALID_CONFIG`
  - `ERR_UNSUPPORTED`
  - `ERR_CRYPTO`
  - `ERR_STORAGE`

- Connector-facing methods may throw a `DAppConnectorAPIError` compatible with `@midnight-ntwrk/dapp-connector-api`:
  - `error.type === "DAppConnectorAPIError"`
  - `error.code` in: `InternalError | Rejected | InvalidRequest | PermissionRejected | Disconnected`
