import { type APIError, ErrorCodes } from "@midnight-ntwrk/dapp-connector-api";

import {
  type ConnectedAPI,
  type PermissionController,
  StaticKeyMaterialProvider,
  type WalletMethodName,
  createDarkWallet,
} from "@dark-wallet/sdk";

import type { RpcRequest, RpcResponse } from "./rpc.js";
import { loadActiveProfile } from "./settings.js";
import { getOrCreateRootSecret } from "./vault.js";

type OffscreenRpcMessage = {
  kind: "dw:rpc";
  request: RpcRequest;
};

type UiPermissionRequest = {
  kind: "dw:ui:permission";
  origin: string;
  methods: WalletMethodName[];
};

type UiPermissionResult = {
  granted: WalletMethodName[];
};

function apiError(code: (typeof ErrorCodes)[keyof typeof ErrorCodes], reason: string): APIError {
  const err = new Error(reason) as APIError;
  err.type = "DAppConnectorAPIError";
  err.code = code;
  err.reason = reason;
  return err;
}

function isApiError(err: unknown): err is APIError {
  if (!err || typeof err !== "object") return false;
  return "type" in err && (err as { type?: unknown }).type === "DAppConnectorAPIError";
}

function sendMessage<T>(msg: unknown): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    chrome.runtime.sendMessage(msg, (res) => {
      const lastErr = chrome.runtime.lastError;
      if (lastErr) reject(new Error(lastErr.message));
      else resolve(res as T);
    });
  });
}

class ExtensionPermissionController implements PermissionController {
  public async request(params: {
    origin: string;
    methods: WalletMethodName[];
  }): Promise<{ granted: WalletMethodName[] }> {
    const res = await sendMessage<UiPermissionResult>({
      kind: "dw:ui:permission",
      origin: params.origin,
      methods: params.methods,
    } satisfies UiPermissionRequest);
    return { granted: res.granted };
  }
}

function sessionKey(origin: string, networkId: string): string {
  return `${origin}::${networkId}`;
}

let wallet: ReturnType<typeof createDarkWallet> | null = null;
let walletNetworkId: string | null = null;
const apis = new Map<string, ConnectedAPI>();

async function ensureWalletForNetwork(
  networkId: string,
): Promise<ReturnType<typeof createDarkWallet>> {
  const active = await loadActiveProfile();
  if (active.networkId !== networkId) {
    throw apiError(
      ErrorCodes.InvalidRequest,
      `Network '${networkId}' is not active in extension settings (active: '${active.networkId}').`,
    );
  }

  if (wallet && walletNetworkId === networkId) return wallet;
  if (wallet && walletNetworkId !== networkId) {
    throw apiError(
      ErrorCodes.InvalidRequest,
      `Wallet host is already initialized for '${walletNetworkId}'. Reload the extension to switch networks.`,
    );
  }

  const rootSecret = await getOrCreateRootSecret();
  const keyMaterial = new StaticKeyMaterialProvider(rootSecret);

  wallet = createDarkWallet({
    keyMaterial,
    permissions: new ExtensionPermissionController(),
    endpoints: {
      networkId,
      indexerUri: active.profile.indexerUri,
      ...(active.profile.indexerWsUri ? { indexerWsUri: active.profile.indexerWsUri } : {}),
      ...(active.profile.proverServerUri
        ? { proverServerUri: active.profile.proverServerUri }
        : {}),
      substrateNodeUri: active.profile.substrateNodeUri,
    },
  });
  walletNetworkId = networkId;
  return wallet;
}

async function handleRpc(req: RpcRequest): Promise<RpcResponse> {
  const key = sessionKey(req.origin, req.networkId);

  try {
    if (req.method === "connect") {
      const w = await ensureWalletForNetwork(req.networkId);
      const api = await w.connect(req.networkId, { origin: req.origin });
      apis.set(key, api);
      return { id: req.id, ok: true, result: undefined };
    }

    const api = apis.get(key);
    if (!api) throw apiError(ErrorCodes.Disconnected, "Not connected.");

    switch (req.method) {
      case "getConfiguration":
        return { id: req.id, ok: true, result: await api.getConfiguration() };
      case "getConnectionStatus":
        return { id: req.id, ok: true, result: await api.getConnectionStatus() };
      case "hintUsage":
        await api.hintUsage(req.params[0] as never);
        return { id: req.id, ok: true, result: undefined };
      case "getUnshieldedAddress":
        return { id: req.id, ok: true, result: await api.getUnshieldedAddress() };
      case "signData":
        return {
          id: req.id,
          ok: true,
          result: await api.signData(req.params[0] as never, req.params[1] as never),
        };

      // Supported but potentially requires the user's infra (indexer/prover/rpc) to be running.
      case "getShieldedBalances":
        return { id: req.id, ok: true, result: await api.getShieldedBalances() };
      case "getUnshieldedBalances":
        return { id: req.id, ok: true, result: await api.getUnshieldedBalances() };
      case "getDustBalance":
        return { id: req.id, ok: true, result: await api.getDustBalance() };
      case "getShieldedAddresses":
        return { id: req.id, ok: true, result: await api.getShieldedAddresses() };
      case "getDustAddress":
        return { id: req.id, ok: true, result: await api.getDustAddress() };
      case "getTxHistory":
        return {
          id: req.id,
          ok: true,
          result: await api.getTxHistory(req.params[0] as never, req.params[1] as never),
        };
      case "balanceUnsealedTransaction":
        return {
          id: req.id,
          ok: true,
          result: await api.balanceUnsealedTransaction(req.params[0] as never),
        };
      case "balanceSealedTransaction":
        return {
          id: req.id,
          ok: true,
          result: await api.balanceSealedTransaction(req.params[0] as never),
        };
      case "makeTransfer":
        return { id: req.id, ok: true, result: await api.makeTransfer(req.params[0] as never) };
      case "makeIntent":
        return {
          id: req.id,
          ok: true,
          result: await api.makeIntent(
            req.params[0] as never,
            req.params[1] as never,
            req.params[2] as never,
          ),
        };
      case "submitTransaction":
        await api.submitTransaction(req.params[0] as never);
        return { id: req.id, ok: true, result: undefined };

      case "getProvingProvider":
        throw apiError(
          ErrorCodes.InvalidRequest,
          "getProvingProvider is not implemented in the extension yet (needs a KeyMaterialProvider proxy).",
        );
      default:
        throw apiError(ErrorCodes.InvalidRequest, `Unknown method '${req.method}'.`);
    }
  } catch (err) {
    if (isApiError(err)) return { id: req.id, ok: false, error: err };
    return { id: req.id, ok: false, error: apiError(ErrorCodes.InternalError, "Internal error.") };
  }
}

chrome.runtime.onMessage.addListener((msg: unknown, _sender, sendResponse) => {
  if (!msg || typeof msg !== "object") return;
  const m = msg as Partial<OffscreenRpcMessage>;
  if (m.kind !== "dw:rpc" || !m.request) return;

  void (async () => {
    sendResponse(await handleRpc(m.request as RpcRequest));
  })();

  return true;
});
