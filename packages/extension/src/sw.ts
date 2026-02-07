import { type APIError, type Configuration, ErrorCodes } from "@midnight-ntwrk/dapp-connector-api";

type RpcRequest = {
  id: number;
  origin: string;
  networkId: string;
  method: string;
  params: unknown[];
};

type RpcResponse =
  | { id: number; ok: true; result: unknown }
  | { id: number; ok: false; error: APIError };

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

type Session = {
  origin: string;
  networkId: string;
};

const sessions = new Map<chrome.runtime.Port, Session>();

async function loadConfiguration(session: Session): Promise<Configuration> {
  // TODO: move to a real settings store (chrome.storage / sync).
  void session;
  return {
    indexerUri: "",
    indexerWsUri: "",
    substrateNodeUri: "",
    networkId: session.networkId,
  };
}

async function handleRequest(session: Session, req: RpcRequest): Promise<unknown> {
  switch (req.method) {
    case "connect":
      return undefined;
    case "getConfiguration":
      return loadConfiguration(session);
    case "getConnectionStatus":
      return { status: "connected", networkId: session.networkId };
    case "hintUsage":
      return undefined;
    default:
      throw apiError(
        ErrorCodes.InvalidRequest,
        `Method '${req.method}' is not implemented in the extension backend yet.`,
      );
  }
}

chrome.runtime.onConnect.addListener((port) => {
  port.onMessage.addListener(async (msg: RpcRequest) => {
    const session = sessions.get(port) ?? { origin: msg.origin, networkId: msg.networkId };
    sessions.set(port, session);

    const reply = async (): Promise<RpcResponse> => {
      try {
        const result = await handleRequest(session, msg);
        return { id: msg.id, ok: true, result };
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
