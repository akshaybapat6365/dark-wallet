import { describe, expect, it } from "vitest";

import { StaticKeyMaterialProvider } from "../../src/key-material/static.js";
import { InMemoryStorageProvider } from "../../src/storage/in_memory.js";
import { createDarkWallet } from "../../src/wallet/create_dark_wallet.js";

function requiredEnv(name: string): string | undefined {
  const v = process.env[name]?.trim();
  return v?.length ? v : undefined;
}

const networkId = requiredEnv("DARKWALLET_IT_NETWORK_ID");
const indexerUri = requiredEnv("DARKWALLET_IT_INDEXER_URI");
const substrateNodeUri = requiredEnv("DARKWALLET_IT_SUBSTRATE_NODE_URI");
const indexerWsUri = requiredEnv("DARKWALLET_IT_INDEXER_WS_URI");
const proverServerUri = requiredEnv("DARKWALLET_IT_PROVER_SERVER_URI");

const hasRequired = !!(networkId && indexerUri && substrateNodeUri);
const describeIt = hasRequired ? describe : describe.skip;

describeIt("integration: sdk (env-gated)", () => {
  it("connect + getConfiguration + getConnectionStatus", async () => {
    if (!networkId || !indexerUri || !substrateNodeUri) {
      throw new Error("Missing required env for integration test.");
    }

    const keyMaterial = new StaticKeyMaterialProvider(new Uint8Array(32).fill(5));
    const storage = new InMemoryStorageProvider();

    const wallet = createDarkWallet({
      keyMaterial,
      storage,
      endpoints: {
        networkId,
        indexerUri,
        ...(indexerWsUri ? { indexerWsUri } : {}),
        ...(proverServerUri ? { proverServerUri } : {}),
        substrateNodeUri,
      },
    });

    const api = await wallet.connect(networkId);
    expect(await api.getConnectionStatus()).toEqual({ status: "connected", networkId });

    const cfg = await api.getConfiguration();
    expect(cfg.networkId).toBe(networkId);
    expect(cfg.indexerUri).toBe(indexerUri);
    expect(cfg.substrateNodeUri).toBe(substrateNodeUri);
  });
});
