import type { PermissionRecord } from "../permissions/types.js";

export type WalletStateV1 = {
  schemaVersion: 1;
  walletId: string;
  createdAt: string;
  networkId: string;
};

export type WalletStateV2 = {
  schemaVersion: 2;
  walletId: string;
  createdAt: string;
  networkId: string;
  permissions: Record<string, PermissionRecord>;
};

export type WalletStateV3 = {
  schemaVersion: 3;
  walletId: string;
  createdAt: string;
  networkId: string;
  permissions: Record<string, PermissionRecord>;
  walletSdkState: {
    shieldedSerialized?: string;
    unshieldedSerialized?: string;
    dustSerialized?: string;
    unshieldedTxHistorySerialized?: string;
  };
};

export type WalletState = WalletStateV3;

export function createInitialState(params: { networkId: string }): WalletStateV3 {
  return {
    schemaVersion: 3,
    walletId:
      globalThis.crypto?.randomUUID?.() ??
      `dw_${Date.now()}_${Math.random().toString(16).slice(2)}`,
    createdAt: new Date().toISOString(),
    networkId: params.networkId,
    permissions: {},
    walletSdkState: {},
  };
}

export function normalizeState(
  state: WalletStateV1 | WalletStateV2 | WalletStateV3 | undefined,
  params: { networkId: string },
): WalletStateV3 {
  if (!state) return createInitialState(params);

  if (state.schemaVersion === 3) return state;

  if (state.schemaVersion === 2) {
    // v2 -> v3 migration: introduce wallet SDK state persistence.
    return {
      schemaVersion: 3,
      walletId: state.walletId,
      createdAt: state.createdAt,
      networkId: state.networkId,
      permissions: state.permissions,
      walletSdkState: {},
    };
  }

  // v1 -> v3 migration.
  return {
    schemaVersion: 3,
    walletId: state.walletId,
    createdAt: state.createdAt,
    networkId: state.networkId,
    permissions: {},
    walletSdkState: {},
  };
}
