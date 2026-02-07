import { type APIError, ErrorCodes } from "@midnight-ntwrk/dapp-connector-api";

import type { RpcRequest, RpcResponse } from "./rpc.js";

type OffscreenRpcMessage = {
  kind: "dw:rpc";
  request: RpcRequest;
};

type UiPermissionRequestMsg = {
  kind: "dw:ui:permission";
  origin: string;
  methods: string[];
};

type UiPermissionResponseMsg = {
  kind: "dw:ui:permission-response";
  requestId: string;
  granted: string[];
};

type UiPermissionResult = {
  granted: string[];
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

async function ensureOffscreenHost(): Promise<void> {
  const has = await chrome.offscreen.hasDocument();
  if (has) return;

  await chrome.offscreen.createDocument({
    url: "offscreen.html",
    reasons: [chrome.offscreen.Reason.BLOBS, chrome.offscreen.Reason.WORKERS],
    justification: "Host Dark Wallet runtime outside the MV3 service worker lifetime limits.",
  });
}

type Session = {
  origin: string;
  networkId: string;
};

const sessions = new Map<chrome.runtime.Port, Session>();

type PendingPrompt = {
  sendResponse: (res: UiPermissionResult) => void;
  windowId: number;
  timeout: number;
};

const pendingPrompts = new Map<string, PendingPrompt>();

function openPermissionPrompt(params: {
  requestId: string;
  origin: string;
  methods: string[];
}): Promise<{ windowId: number }> {
  const base = chrome.runtime.getURL("permission.html");
  const url =
    `${base}?rid=${encodeURIComponent(params.requestId)}` +
    `&origin=${encodeURIComponent(params.origin)}` +
    `&methods=${params.methods.map((m) => encodeURIComponent(m)).join(",")}`;

  return new Promise((resolve, reject) => {
    chrome.windows.create(
      {
        url,
        type: "popup",
        width: 440,
        height: 560,
        focused: true,
      },
      (w) => {
        const lastErr = chrome.runtime.lastError;
        if (lastErr) {
          reject(new Error(lastErr.message));
          return;
        }
        const windowId = w?.id;
        if (typeof windowId !== "number") {
          reject(new Error("Failed to open permission prompt window."));
          return;
        }
        resolve({ windowId });
      },
    );
  });
}

chrome.windows.onRemoved.addListener((windowId) => {
  for (const [rid, p] of pendingPrompts.entries()) {
    if (p.windowId !== windowId) continue;
    clearTimeout(p.timeout);
    p.sendResponse({ granted: [] });
    pendingPrompts.delete(rid);
  }
});

chrome.runtime.onMessage.addListener((msg: unknown, _sender, sendResponse) => {
  if (!msg || typeof msg !== "object") return;

  const m = msg as {
    kind?: unknown;
    origin?: unknown;
    methods?: unknown;
    requestId?: unknown;
    granted?: unknown;
  };

  if (m.kind === "dw:ui:permission") {
    const requestId = `dw_perm_${Date.now()}_${Math.random().toString(16).slice(2)}`;
    const origin = typeof m.origin === "string" ? m.origin : "";
    const methods = Array.isArray(m.methods)
      ? m.methods.filter((x: unknown): x is string => typeof x === "string")
      : [];

    void (async () => {
      try {
        const { windowId } = await openPermissionPrompt({ requestId, origin, methods });

        const timeout = setTimeout(() => {
          const p = pendingPrompts.get(requestId);
          if (!p) return;
          p.sendResponse({ granted: [] });
          pendingPrompts.delete(requestId);
        }, 60_000);

        pendingPrompts.set(requestId, {
          sendResponse: sendResponse as (res: UiPermissionResult) => void,
          windowId,
          timeout: timeout as unknown as number,
        });
      } catch (_err) {
        sendResponse({ granted: [] });
      }
    })();

    return true;
  }

  if (m.kind === "dw:ui:permission-response") {
    const requestId = typeof m.requestId === "string" ? m.requestId : "";
    const p = pendingPrompts.get(requestId);
    if (!p) return;
    clearTimeout(p.timeout);
    pendingPrompts.delete(requestId);

    const granted = Array.isArray(m.granted)
      ? m.granted.filter((x: unknown): x is string => typeof x === "string")
      : [];
    p.sendResponse({ granted });
    return;
  }
});

chrome.runtime.onConnect.addListener((port) => {
  port.onMessage.addListener(async (msg: RpcRequest) => {
    const session = sessions.get(port) ?? { origin: msg.origin, networkId: msg.networkId };
    sessions.set(port, session);

    // Defensive: bind the session to its first observed origin/network.
    if (msg.origin !== session.origin || msg.networkId !== session.networkId) {
      port.postMessage({
        id: msg.id,
        ok: false,
        error: apiError(ErrorCodes.InvalidRequest, "Session origin/network mismatch."),
      } satisfies RpcResponse);
      return;
    }

    const reply = async (): Promise<RpcResponse> => {
      try {
        await ensureOffscreenHost();
        const res = await sendMessage<RpcResponse>({
          kind: "dw:rpc",
          request: msg,
        } satisfies OffscreenRpcMessage);
        return res;
      } catch (err) {
        if (isApiError(err)) return { id: msg.id, ok: false, error: err };
        return {
          id: msg.id,
          ok: false,
          error: apiError(ErrorCodes.InternalError, "Internal error."),
        };
      }
    };

    port.postMessage(await reply());
  });

  port.onDisconnect.addListener(() => {
    sessions.delete(port);
  });
});
