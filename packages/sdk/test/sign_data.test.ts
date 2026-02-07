import { describe, expect, it } from "vitest";

import * as ledger from "@midnight-ntwrk/ledger-v7";

import { StaticKeyMaterialProvider } from "../src/key-material/static.js";
import { InMemoryStorageProvider } from "../src/storage/in_memory.js";
import { createDarkWallet } from "../src/wallet/create_dark_wallet.js";

function prefix(params: { origin: string; networkId: string }): Uint8Array {
  const text = [
    "Midnight Signed Message (Dark Wallet)",
    `origin:${params.origin}`,
    `network:${params.networkId}`,
    "",
  ].join("\n");
  return new TextEncoder().encode(text);
}

function concatBytes(a: Uint8Array, b: Uint8Array): Uint8Array {
  const out = new Uint8Array(a.length + b.length);
  out.set(a, 0);
  out.set(b, a.length);
  return out;
}

describe("signData", () => {
  it("signs with domain-separated payload and verifies with returned verifyingKey", async () => {
    const keyMaterial = new StaticKeyMaterialProvider(new Uint8Array(32).fill(7));
    const storage = new InMemoryStorageProvider();

    const wallet = createDarkWallet({
      keyMaterial,
      storage,
      endpoints: {
        networkId: "testnet",
        indexerUri: "http://127.0.0.1:8088/api/v1/graphql",
        indexerWsUri: "ws://127.0.0.1:8088/api/v1/graphql",
        proverServerUri: "http://127.0.0.1:6300",
        substrateNodeUri: "wss://rpc.testnet-02.midnight.network",
      },
    });

    const api = await wallet.connect("testnet");
    const sig = await api.signData("hello", { encoding: "text", keyType: "unshielded" });

    const payload = concatBytes(
      prefix({ origin: "embedded", networkId: "testnet" }),
      new TextEncoder().encode("hello"),
    );
    expect(ledger.verifySignature(sig.verifyingKey, payload, sig.signature)).toBe(true);
  });
});
