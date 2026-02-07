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

export type WalletState = WalletStateV2;

export function createInitialState(params: { networkId: string }): WalletStateV2 {
  return {
    schemaVersion: 2,
    walletId:
      globalThis.crypto?.randomUUID?.() ??
      `dw_${Date.now()}_${Math.random().toString(16).slice(2)}`,
    createdAt: new Date().toISOString(),
    networkId: params.networkId,
    permissions: {},
  };
}

export function normalizeState(
  state: WalletStateV1 | WalletStateV2 | undefined,
  params: { networkId: string },
): WalletStateV2 {
  if (!state) return createInitialState(params);

  if (state.schemaVersion === 2) return state;

  // v1 -> v2 migration: introduce permissions store.
  return {
    schemaVersion: 2,
    walletId: state.walletId,
    createdAt: state.createdAt,
    networkId: state.networkId,
    permissions: {},
  };
}
