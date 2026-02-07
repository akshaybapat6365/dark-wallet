export { DarkWalletError } from "./errors.js";
export { Emitter } from "./events/emitter.js";

export type { ConnectedAPI, InitialAPI } from "./api/types.js";

export type { KeyMaterialProvider } from "./key-material/types.js";
export { StaticKeyMaterialProvider } from "./key-material/static.js";
export {
  WebAuthnKeyMaterialProvider,
  createPasskeyCredentialId,
  deriveRootSecretFromPasskey,
  isProbablyWebAuthnAvailable,
  normalizeCredentialIdBase64,
  type CreatePasskeyParams,
  type DeriveRootSecretParams,
  type WebAuthnDerivationMode,
} from "./key-material/webauthn.js";

export type { StorageProvider } from "./storage/types.js";
export { InMemoryStorageProvider } from "./storage/in_memory.js";
export { IndexedDbStorageProvider } from "./storage/indexed_db.js";

export type {
  PermissionController,
  PermissionRecord,
  WalletMethodName,
} from "./permissions/types.js";
export { AllowAllPermissionController, DenyAllPermissionController } from "./permissions/types.js";

export type {
  DarkWallet,
  ConnectOptions,
  DarkWalletConfig,
  EndpointsConfig,
  WalletEvents,
} from "./wallet/types.js";
export { createDarkWallet } from "./wallet/create_dark_wallet.js";
