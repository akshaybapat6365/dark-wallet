# Embedded SDK Design (`@dark-wallet/sdk`)

## Public API
- `createDarkWallet(config): DarkWallet`
- `DarkWallet.connect(networkId): Promise<ConnectedAPI>`

## Design Rules
- Isomorphic: works in browser + extension + Node (tests/dev).
- Strict interfaces around side effects:
  - `StorageProvider`
  - `KeyMaterialProvider`
  - `CryptoProvider`

## State Model
- Versioned state container (`schemaVersion`)
- Encrypted at rest (AES-256-GCM)

