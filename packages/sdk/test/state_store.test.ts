import { describe, expect, it } from "vitest";

import { EncryptedStateStore } from "../src/state/encrypted_state_store.js";
import { InMemoryStorageProvider } from "../src/storage/in_memory.js";

describe("EncryptedStateStore", () => {
  it("encrypts at rest and loads correctly", async () => {
    const storage = new InMemoryStorageProvider();
    const storageKey = new Uint8Array(32).fill(1);
    const store = new EncryptedStateStore({ storage, storageKey });

    const value = { hello: "world", n: 123 };
    await store.save(value);

    const raw = await storage.get("dark-wallet:state");
    expect(raw).toBeTruthy();
    expect(raw).not.toContain("world"); // should not be plaintext

    const loaded = await store.load<typeof value>();
    expect(loaded).toEqual(value);
  });
});
