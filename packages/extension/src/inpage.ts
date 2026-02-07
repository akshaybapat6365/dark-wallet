import type {
  ConnectedAPI,
  InitialAPI,
  WalletConnectedAPI,
} from "@midnight-ntwrk/dapp-connector-api";

type RpcRequest = {
  id: number;
  origin: string;
  networkId: string;
  method: keyof WalletConnectedAPI | "hintUsage" | "connect";
  params: unknown[];
};

type RpcResponse =
  | { id: number; ok: true; result: unknown }
  | { id: number; ok: false; error: unknown };

function uuid(): string {
  return (
    globalThis.crypto?.randomUUID?.() ?? `dw_${Date.now()}_${Math.random().toString(16).slice(2)}`
  );
}

function ensureMidnightGlobal(): Record<string, InitialAPI> {
  const w = window as Window & { midnight?: Record<string, InitialAPI> };
  if (w.midnight) return w.midnight;

  const obj = Object.create(null) as Record<string, InitialAPI>;
  Object.defineProperty(w, "midnight", {
    value: obj,
    writable: false,
    configurable: false,
    enumerable: true,
  });
  return obj;
}

function makeRpcClient(params: { origin: string; networkId: string }) {
  const port = chrome.runtime.connect({ name: "darkwallet" });
  let nextId = 1;
  const pending = new Map<
    number,
    { resolve: (v: unknown) => void; reject: (e: unknown) => void }
  >();

  port.onMessage.addListener((msg: RpcResponse) => {
    const handler = pending.get(msg.id);
    if (!handler) return;
    pending.delete(msg.id);
    if (msg.ok) handler.resolve(msg.result);
    else handler.reject(msg.error);
  });

  port.onDisconnect.addListener(() => {
    for (const [, handler] of pending) handler.reject(new Error("Disconnected."));
    pending.clear();
  });

  function rpc<T>(method: RpcRequest["method"], ...paramsList: unknown[]): Promise<T> {
    const id = nextId++;
    const req: RpcRequest = {
      id,
      origin: params.origin,
      networkId: params.networkId,
      method,
      params: paramsList,
    };
    port.postMessage(req);
    return new Promise<T>((resolve, reject) => {
      pending.set(id, { resolve: (v) => resolve(v as T), reject });
    });
  }

  return { rpc };
}

function createConnectedApi(params: {
  rpc: <T>(m: RpcRequest["method"], ...p: unknown[]) => Promise<T>;
}): ConnectedAPI {
  const call = params.rpc;
  const api: ConnectedAPI = {
    getShieldedBalances: () => call("getShieldedBalances"),
    getUnshieldedBalances: () => call("getUnshieldedBalances"),
    getDustBalance: () => call("getDustBalance"),
    getShieldedAddresses: () => call("getShieldedAddresses"),
    getUnshieldedAddress: () => call("getUnshieldedAddress"),
    getDustAddress: () => call("getDustAddress"),
    getTxHistory: (pageNumber, pageSize) => call("getTxHistory", pageNumber, pageSize),
    balanceUnsealedTransaction: (tx) => call("balanceUnsealedTransaction", tx),
    balanceSealedTransaction: (tx) => call("balanceSealedTransaction", tx),
    makeTransfer: (desiredOutputs) => call("makeTransfer", desiredOutputs),
    makeIntent: (desiredInputs, desiredOutputs, options) =>
      call("makeIntent", desiredInputs, desiredOutputs, options),
    signData: (data, options) => call("signData", data, options),
    submitTransaction: (tx) => call("submitTransaction", tx),
    getProvingProvider: (kmp) => call("getProvingProvider", kmp),
    getConfiguration: () => call("getConfiguration"),
    getConnectionStatus: () => call("getConnectionStatus"),
    hintUsage: (methodNames) => call("hintUsage", methodNames),
  };
  return Object.freeze(api);
}

function install(): void {
  const midnight = ensureMidnightGlobal();
  const id = uuid();

  const initialApi: InitialAPI = {
    rdns: "io.darkwallet.app",
    name: "Dark Wallet",
    icon: "",
    apiVersion: "4.0.0",
    async connect(networkId: string): Promise<ConnectedAPI> {
      const origin = window.location.origin;
      const client = makeRpcClient({ origin, networkId });
      await client.rpc("connect", networkId);
      return createConnectedApi({ rpc: client.rpc });
    },
  };

  Object.defineProperty(midnight, id, {
    configurable: false,
    writable: false,
    enumerable: true,
    value: Object.freeze(initialApi),
  });

  // Do not freeze `window.midnight` itself to avoid breaking other wallets coexisting.
}

install();
