import { describe, expect, it } from "vitest";

import type { DarkWalletError } from "../src/errors.js";
import { StaticKeyMaterialProvider } from "../src/key-material/static.js";
import { InMemoryStorageProvider } from "../src/storage/in_memory.js";
import { createDarkWallet } from "../src/wallet/create_dark_wallet.js";

describe("Encrypted Private State Backup (EPSB)", () => {
  it("export/import roundtrips encrypted state", async () => {
    const keyMaterial = new StaticKeyMaterialProvider(new Uint8Array(32).fill(9));

    const storage1 = new InMemoryStorageProvider();
    const wallet1 = createDarkWallet({
      keyMaterial,
      storage: storage1,
      endpoints: {
        networkId: "testnet",
        indexerUri: "http://127.0.0.1:8088/api/v1/graphql",
        indexerWsUri: "ws://127.0.0.1:8088/api/v1/graphql",
        proverServerUri: "http://127.0.0.1:6300",
        substrateNodeUri: "wss://rpc.testnet-02.midnight.network",
      },
    });

    const ready1Promise = new Promise<{ walletId: string; networkId: string }>((resolve) => {
      const off = wallet1.events.on("ready", (e) => {
        off();
        resolve(e);
      });
    });
    await wallet1.connect("testnet");
    const ready1 = await ready1Promise;

    const backup = await wallet1.exportEncryptedBackup("correct-horse-battery-staple");

    const storage2 = new InMemoryStorageProvider();
    const wallet2 = createDarkWallet({
      keyMaterial,
      storage: storage2,
      endpoints: {
        networkId: "testnet",
        indexerUri: "http://127.0.0.1:8088/api/v1/graphql",
        indexerWsUri: "ws://127.0.0.1:8088/api/v1/graphql",
        proverServerUri: "http://127.0.0.1:6300",
        substrateNodeUri: "wss://rpc.testnet-02.midnight.network",
      },
    });

    await wallet2.importEncryptedBackup("correct-horse-battery-staple", backup);

    const ready2Promise = new Promise<{ walletId: string; networkId: string }>((resolve) => {
      const off = wallet2.events.on("ready", (e) => {
        off();
        resolve(e);
      });
    });
    await wallet2.connect("testnet");
    const ready2 = await ready2Promise;

    expect(ready2.walletId).toBe(ready1.walletId);
    expect(ready2.networkId).toBe("testnet");
  });

  it("rejects wrong password", async () => {
    const keyMaterial = new StaticKeyMaterialProvider(new Uint8Array(32).fill(10));
    const storage = new InMemoryStorageProvider();

    const wallet = createDarkWallet({
      keyMaterial,
      storage,
      endpoints: {
        networkId: "testnet",
        indexerUri: "http://127.0.0.1:8088/api/v1/graphql",
        proverServerUri: "http://127.0.0.1:6300",
        substrateNodeUri: "wss://rpc.testnet-02.midnight.network",
      },
    });

    await wallet.connect("testnet");
    const backup = await wallet.exportEncryptedBackup("correct-horse-battery-staple");

    const wallet2 = createDarkWallet({
      keyMaterial,
      storage: new InMemoryStorageProvider(),
      endpoints: {
        networkId: "testnet",
        indexerUri: "http://127.0.0.1:8088/api/v1/graphql",
        proverServerUri: "http://127.0.0.1:6300",
        substrateNodeUri: "wss://rpc.testnet-02.midnight.network",
      },
    });

    await expect(wallet2.importEncryptedBackup("not-the-password", backup)).rejects.toMatchObject({
      name: "DarkWalletError",
      code: "ERR_CRYPTO",
    } satisfies Partial<DarkWalletError>);
  });

  it("rejects corrupted backup JSON", async () => {
    const keyMaterial = new StaticKeyMaterialProvider(new Uint8Array(32).fill(11));
    const storage = new InMemoryStorageProvider();

    const wallet = createDarkWallet({
      keyMaterial,
      storage,
      endpoints: {
        networkId: "testnet",
        indexerUri: "http://127.0.0.1:8088/api/v1/graphql",
        proverServerUri: "http://127.0.0.1:6300",
        substrateNodeUri: "wss://rpc.testnet-02.midnight.network",
      },
    });

    await wallet.connect("testnet");
    const backup = await wallet.exportEncryptedBackup("correct-horse-battery-staple");

    const corrupted = backup.replace(/\"ct\":\"[^\"]+\"/, '"ct":"AAAA"');

    const wallet2 = createDarkWallet({
      keyMaterial,
      storage: new InMemoryStorageProvider(),
      endpoints: {
        networkId: "testnet",
        indexerUri: "http://127.0.0.1:8088/api/v1/graphql",
        proverServerUri: "http://127.0.0.1:6300",
        substrateNodeUri: "wss://rpc.testnet-02.midnight.network",
      },
    });

    await expect(
      wallet2.importEncryptedBackup("correct-horse-battery-staple", corrupted),
    ).rejects.toMatchObject({ name: "DarkWalletError" } satisfies Partial<DarkWalletError>);
  });

  it("export fails when no state exists", async () => {
    const keyMaterial = new StaticKeyMaterialProvider(new Uint8Array(32).fill(12));
    const wallet = createDarkWallet({
      keyMaterial,
      storage: new InMemoryStorageProvider(),
      endpoints: {
        networkId: "testnet",
        indexerUri: "http://127.0.0.1:8088/api/v1/graphql",
        proverServerUri: "http://127.0.0.1:6300",
        substrateNodeUri: "wss://rpc.testnet-02.midnight.network",
      },
    });

    await expect(
      wallet.exportEncryptedBackup("correct-horse-battery-staple"),
    ).rejects.toMatchObject({
      name: "DarkWalletError",
      code: "ERR_STORAGE",
    } satisfies Partial<DarkWalletError>);
  });
});
