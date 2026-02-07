export type WalletStateV1 = {
  schemaVersion: 1;
  walletId: string;
  createdAt: string;
  networkId: string;
};

export type WalletState = WalletStateV1;

export function createInitialState(params: { networkId: string }): WalletStateV1 {
  return {
    schemaVersion: 1,
    walletId:
      globalThis.crypto?.randomUUID?.() ??
      `dw_${Date.now()}_${Math.random().toString(16).slice(2)}`,
    createdAt: new Date().toISOString(),
    networkId: params.networkId,
  };
}
