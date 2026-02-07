import { describe, expect, it } from "vitest";

import { StaticKeyMaterialProvider } from "../src/key-material/static.js";
import { InMemoryStorageProvider } from "../src/storage/in_memory.js";
import { createDarkWallet } from "../src/wallet/create_dark_wallet.js";

describe("createDarkWallet", () => {
  it("connect returns ConnectedAPI with configuration", async () => {
    const keyMaterial = new StaticKeyMaterialProvider(new Uint8Array(32).fill(3));
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

    const events: Array<{ walletId: string; networkId: string }> = [];
    wallet.events.on("ready", (e) => events.push(e));

    const api = await wallet.connect("testnet");
    const cfg = await api.getConfiguration();

    expect(cfg.networkId).toBe("testnet");
    expect(cfg.proverServerUri).toBe("http://127.0.0.1:6300");
    expect(events).toHaveLength(1);
  });
});
