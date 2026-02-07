import type { APIError, ErrorCode } from "./types.js";

/**
 * Create an error object compatible with `@midnight-ntwrk/dapp-connector-api`.
 *
 * The upstream type intentionally isn't a class (to avoid `instanceof` traps across realms),
 * so we construct an `Error` and brand it with the required fields.
 */
export function apiError(code: ErrorCode, reason: string, cause?: unknown): APIError {
  const base = cause === undefined ? new Error(reason) : new Error(reason, { cause });
  const err = base as APIError;
  err.type = "DAppConnectorAPIError";
  err.code = code;
  err.reason = reason;
  return err;
}
