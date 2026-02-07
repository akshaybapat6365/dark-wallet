# Embedded SDK Design (`@dark-wallet/sdk`)

## Public API
- `createDarkWallet(config): DarkWallet`
- `DarkWallet.connect(networkId, options?): Promise<ConnectedAPI>`
  - `options.origin?: string` scopes permissions + `signData` domain separation (used by extension hosts).

## Design Rules
- Isomorphic: works in browser + extension + Node (tests/dev).
- Strict interfaces around side effects:
  - `StorageProvider`
  - `KeyMaterialProvider`
  - `CryptoProvider`

## State Model
- Versioned state container (`schemaVersion`)
- Encrypted at rest (AES-256-GCM)

## Backup (EPSB)
The SDK supports exporting/importing an encrypted backup of the encrypted state blob:
- `wallet.exportEncryptedBackup(password)`
- `wallet.importEncryptedBackup(password, backupJson)`
