import * as ledger from "@midnight-ntwrk/ledger-v7";
import { describe, expect, it } from "vitest";

import type { APIError } from "../src/api/types.js";
import { resegmentIntentTx } from "../src/midnight/intent_segment.js";

function makeSingleIntentTx(): ledger.UnprovenTransaction {
  const ttl = new Date(Date.now() + 60_000);
  const intent = ledger.Intent.new(ttl);

  const coin = ledger.createShieldedCoinInfo(ledger.shieldedToken().raw, 1n);
  const out = ledger.ZswapOutput.new(
    coin,
    1,
    ledger.sampleCoinPublicKey(),
    ledger.sampleEncryptionPublicKey(),
  );
  const offer = ledger.ZswapOffer.fromOutput(out);

  return ledger.Transaction.fromParts("testnet", undefined, offer, intent);
}

describe("resegmentIntentTx", () => {
  it("moves intent + fallibleOffer to a requested segment", () => {
    const tx = makeSingleIntentTx();
    expect(tx.intents?.size).toBe(1);
    expect(tx.fallibleOffer?.size).toBe(1);

    const oldId = [...(tx.intents?.keys() ?? [])][0];
    expect(typeof oldId).toBe("number");
    expect(tx.fallibleOffer?.has(oldId as number)).toBe(true);

    const nextId = oldId === 42 ? 43 : 42;
    resegmentIntentTx(tx, nextId);

    expect(tx.intents?.has(nextId)).toBe(true);
    expect(tx.intents?.has(oldId as number)).toBe(false);
    expect(tx.fallibleOffer?.has(nextId)).toBe(true);
    expect(tx.fallibleOffer?.has(oldId as number)).toBe(false);
  });

  it("randomizes away from the original segment", () => {
    const tx = makeSingleIntentTx();
    const oldId = [...(tx.intents?.keys() ?? [])][0];
    expect(typeof oldId).toBe("number");

    resegmentIntentTx(tx, "random");

    const nextId = [...(tx.intents?.keys() ?? [])][0];
    expect(nextId).not.toBe(oldId);
    expect(typeof nextId).toBe("number");
    expect(nextId).toBeGreaterThanOrEqual(1);
    expect(nextId).toBeLessThanOrEqual(65535);
  });

  it("rejects invalid segment ids", () => {
    const tx = makeSingleIntentTx();

    const bad = [0, -1, 65536, 1.2];
    for (const id of bad) {
      let thrown: unknown;
      try {
        resegmentIntentTx(makeSingleIntentTx(), id as number);
      } catch (err) {
        thrown = err;
      }
      expect(thrown).toMatchObject({
        type: "DAppConnectorAPIError",
      } satisfies Partial<APIError>);
    }

    // original tx should still be valid
    expect(tx.intents?.size).toBe(1);
  });
});
