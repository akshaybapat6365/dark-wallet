export type DarkWalletErrorCode =
  | "ERR_INVALID_CONFIG"
  | "ERR_UNSUPPORTED"
  | "ERR_NOT_IMPLEMENTED"
  | "ERR_CRYPTO"
  | "ERR_STORAGE";

export class DarkWalletError extends Error {
  public readonly code: DarkWalletErrorCode;
  public readonly cause?: unknown;

  public constructor(code: DarkWalletErrorCode, message: string, cause?: unknown) {
    super(message);
    this.name = "DarkWalletError";
    this.code = code;
    this.cause = cause;
  }
}

export function notImplemented(message: string): DarkWalletError {
  return new DarkWalletError("ERR_NOT_IMPLEMENTED", message);
}
