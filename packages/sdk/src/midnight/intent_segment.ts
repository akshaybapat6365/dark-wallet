import type * as ledger from "@midnight-ntwrk/ledger-v7";

import { apiError } from "../api/api_error.js";
import { ErrorCodes } from "../api/types.js";
import { randomBytes } from "../crypto/webcrypto.js";

const MIN_SEGMENT_ID = 1;
const MAX_SEGMENT_ID = 65535;

function assertValidSegmentId(id: number): void {
  if (!Number.isInteger(id) || id < MIN_SEGMENT_ID || id > MAX_SEGMENT_ID) {
    throw apiError(
      ErrorCodes.InvalidRequest,
      `Invalid intentId '${id}'. Expected an integer in range ${MIN_SEGMENT_ID}..${MAX_SEGMENT_ID}.`,
    );
  }
}

function sampleSegmentIdNotEqualTo(forbidden: number): number {
  // Uniform over 16-bit, mapping 0 -> 1. Retry to avoid forbidden collisions.
  for (let i = 0; i < 16; i++) {
    const bytes = randomBytes(2);
    const raw = ((bytes[0] ?? 0) << 8) | (bytes[1] ?? 0);
    const id = raw === 0 ? 1 : raw;
    if (id !== forbidden) return id;
  }
  // Extremely unlikely; pick a deterministic fallback.
  return forbidden === 1 ? 2 : 1;
}

/**
 * Re-map the single intent contained in an UnprovenTransaction to a requested segment ID.
 *
 * Connector `makeIntent()` exposes an `intentId` so dApps can merge intents into composite txs.
 * Ledger-v7 represents this as the segment ID key in `tx.intents` (and usually `tx.fallibleOffer`).
 */
export function resegmentIntentTx(
  tx: ledger.UnprovenTransaction,
  intentId: number | "random",
): ledger.UnprovenTransaction {
  const intents = tx.intents;
  if (!intents || intents.size === 0) {
    throw apiError(ErrorCodes.InternalError, "makeIntent produced a transaction with no intents.");
  }
  if (intents.size !== 1) {
    throw apiError(
      ErrorCodes.InvalidRequest,
      `makeIntent currently supports only single-intent transactions (got ${intents.size}).`,
    );
  }

  const [oldId, intent] = intents.entries().next().value as [number, ledger.UnprovenIntent];
  const nextId = intentId === "random" ? sampleSegmentIdNotEqualTo(oldId) : intentId;
  assertValidSegmentId(nextId);

  if (nextId === oldId) return tx;

  tx.intents = new Map([[nextId, intent]]);

  const fallible = tx.fallibleOffer;
  if (fallible?.size) {
    if (fallible.has(nextId)) {
      throw apiError(
        ErrorCodes.InvalidRequest,
        `Cannot resegment intent: fallibleOffer already contains segment ${nextId}.`,
      );
    }
    const offer = fallible.get(oldId);
    if (offer) {
      const next = new Map(fallible);
      next.delete(oldId);
      next.set(nextId, offer);
      tx.fallibleOffer = next;
    }
  }

  return tx;
}
