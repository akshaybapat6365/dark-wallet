# `@dark-wallet/sdk` API Reference (v0)

Status: **early skeleton**. Only `getConfiguration()` is fully implemented; most `ConnectedAPI` methods throw `ERR_NOT_IMPLEMENTED`.

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

const api = await wallet.connect("testnet");
const cfg = await api.getConfiguration();
```

### Passkey-derived key material (browser)
```ts
import { WebAuthnKeyMaterialProvider } from "@dark-wallet/sdk";

const keyMaterial = new WebAuthnKeyMaterialProvider({
  credentialId: "<base64 rawId>",
  mode: "prf", // fallback: "hmac-secret"
});
```

## Errors
- `DarkWalletError`
  - `ERR_INVALID_CONFIG`
  - `ERR_UNSUPPORTED`
  - `ERR_NOT_IMPLEMENTED`
  - `ERR_CRYPTO`
  - `ERR_STORAGE`

