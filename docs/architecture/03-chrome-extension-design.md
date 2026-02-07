# Chrome Extension Design (MV3)

## Responsibilities
- Implement dApp Connector API injection (`window.midnight[uuid]`)
- Request/approval UX and origin permissions
- Message bridge and long-lived state persistence

## Key Constraints
- MV3 service workers can be suspended; long-running wallet work must not live in SW.
- Use `MAIN` world for reliable injection.

## Implemented Runtime Architecture (v0)

### 1. Inpage Injection (Content Script, MAIN world)
- Injects a unique provider under `window.midnight[uuid]`
- Uses `chrome.runtime.connect()` + port messaging for RPC

Files:
- `packages/extension/src/inpage.ts`

### 2. Service Worker (Router + UI Launcher)
- Ensures the offscreen host exists via `chrome.offscreen.createDocument()`
- Forwards all RPC to the offscreen host (`chrome.runtime.sendMessage`)
- Opens permission prompt windows and returns the decision to the offscreen host

Files:
- `packages/extension/src/sw.ts`

### 3. Offscreen Host (Wallet Runtime)
- Owns the `@dark-wallet/sdk` instance and executes connector methods
- Uses `wallet.connect(networkId, { origin })` to scope permissions per dApp origin
- Keeps per-origin connected sessions keyed by `origin::networkId`
- Currently rejects `getProvingProvider` (needs a KeyMaterialProvider proxy across the boundary)

Files:
- `packages/extension/src/offscreen.ts`

### 4. Options + Permission UI Pages
- `options.html`: configure endpoints (active network + indexer/prover/substrate URIs)
- `permission.html`: approve/deny method allow-list for a given origin

Files:
- `packages/extension/public/options.html`, `packages/extension/src/options.ts`
- `packages/extension/public/permission.html`, `packages/extension/src/permission.ts`
