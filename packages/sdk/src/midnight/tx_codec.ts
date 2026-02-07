import * as ledger from "@midnight-ntwrk/ledger-v7";

import { apiError } from "../api/api_error.js";
import { ErrorCodes } from "../api/types.js";
import { bytesToHex, hexToBytes } from "../encoding/hex.js";

export function serializeTx(tx: { serialize(): Uint8Array }): string {
  return bytesToHex(tx.serialize());
}

export function deserializeUnprovenTx(txHex: string): ledger.UnprovenTransaction {
  const raw = hexToBytes(txHex);
  try {
    return ledger.Transaction.deserialize("signature", "pre-proof", "pre-binding", raw);
  } catch (err) {
    throw apiError(ErrorCodes.InvalidRequest, "Failed to deserialize UnprovenTransaction.", err);
  }
}

export function deserializeUnboundTx(
  txHex: string,
): ledger.Transaction<ledger.SignatureEnabled, ledger.Proof, ledger.PreBinding> {
  const raw = hexToBytes(txHex);
  try {
    return ledger.Transaction.deserialize("signature", "proof", "pre-binding", raw);
  } catch (err) {
    throw apiError(ErrorCodes.InvalidRequest, "Failed to deserialize UnboundTransaction.", err);
  }
}

export function deserializeFinalizedTx(txHex: string): ledger.FinalizedTransaction {
  const raw = hexToBytes(txHex);
  try {
    return ledger.Transaction.deserialize("signature", "proof", "binding", raw);
  } catch (err) {
    throw apiError(ErrorCodes.InvalidRequest, "Failed to deserialize FinalizedTransaction.", err);
  }
}
