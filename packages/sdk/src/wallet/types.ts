import type { ConnectedAPI, InitialAPI } from "../api/types.js";
import type { Emitter } from "../events/emitter.js";
import type { KeyMaterialProvider } from "../key-material/types.js";
import type { PermissionController } from "../permissions/types.js";
import type { StorageProvider } from "../storage/types.js";

export type EndpointsConfig = {
  networkId: string;
  indexerUri: string;
  indexerWsUri?: string;
  proverServerUri?: string;
  substrateNodeUri: string;
};

export type DarkWalletConfig = {
  rdns?: string;
  name?: string;
  icon?: string;
  apiVersion?: string;
  /**
   * Connection context used for permission scoping.
   *
   * - embedded SDK: defaults to "embedded"
   * - extension: set to the requesting origin (e.g. "https://dapp.example")
   */
  origin?: string;
  endpoints: EndpointsConfig;
  storage?: StorageProvider;
  keyMaterial: KeyMaterialProvider;
  permissions?: PermissionController;
};

export type WalletEvents = {
  ready: { walletId: string; networkId: string };
  stateChanged: { walletId: string };
};

export type DarkWallet = InitialAPI & {
  events: Emitter<WalletEvents>;
  destroy(): Promise<void>;
};

export type ConnectResult = ConnectedAPI;
