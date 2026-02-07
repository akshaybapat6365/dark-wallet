import type { APIError, WalletConnectedAPI } from "@midnight-ntwrk/dapp-connector-api";

export type RpcRequest = {
  id: number;
  origin: string;
  networkId: string;
  method: keyof WalletConnectedAPI | "hintUsage" | "connect";
  params: unknown[];
};

export type RpcResponse =
  | { id: number; ok: true; result: unknown }
  | { id: number; ok: false; error: APIError };
