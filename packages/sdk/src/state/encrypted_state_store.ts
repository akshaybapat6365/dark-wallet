import { aesGcmDecrypt, aesGcmEncrypt } from "../crypto/webcrypto.js";
import { base64ToBytes, bytesToBase64 } from "../encoding/base64.js";
import { DarkWalletError } from "../errors.js";
import type { StorageProvider } from "../storage/types.js";

type EncryptedBlobV1 = {
  v: 1;
  alg: "A256GCM";
  iv: string; // base64
  ct: string; // base64
};

const AAD = new TextEncoder().encode("dark-wallet:state:v1");

export class EncryptedStateStore {
  private readonly storage: StorageProvider;
  private readonly storageKey: Uint8Array; // 32 bytes
  private readonly recordKey: string;

  public constructor(params: {
    storage: StorageProvider;
    storageKey: Uint8Array;
    recordKey?: string;
  }) {
    if (params.storageKey.length !== 32) {
      throw new DarkWalletError(
        "ERR_INVALID_CONFIG",
        "storageKey must be 32 bytes for AES-256-GCM.",
      );
    }
    this.storage = params.storage;
    this.storageKey = new Uint8Array(params.storageKey);
    this.recordKey = params.recordKey ?? "dark-wallet:state";
  }

  public async load<T>(): Promise<T | null> {
    const raw = await this.storage.get(this.recordKey);
    if (!raw) return null;

    let blob: EncryptedBlobV1;
    try {
      blob = JSON.parse(raw) as EncryptedBlobV1;
    } catch (err) {
      throw new DarkWalletError("ERR_STORAGE", "Failed to parse encrypted state blob.", err);
    }

    if (blob.v !== 1 || blob.alg !== "A256GCM") {
      throw new DarkWalletError(
        "ERR_STORAGE",
        "Unsupported encrypted state blob version/algorithm.",
      );
    }

    const iv = base64ToBytes(blob.iv);
    const ct = base64ToBytes(blob.ct);
    const pt = await aesGcmDecrypt({ key: this.storageKey, iv, ciphertext: ct, aad: AAD });
    try {
      return JSON.parse(new TextDecoder().decode(pt)) as T;
    } catch (err) {
      throw new DarkWalletError("ERR_STORAGE", "Failed to decode decrypted state JSON.", err);
    }
  }

  public async save<T>(value: T): Promise<void> {
    const json = JSON.stringify(value);
    const pt = new TextEncoder().encode(json);
    const { iv, ciphertext } = await aesGcmEncrypt({
      key: this.storageKey,
      plaintext: pt,
      aad: AAD,
    });

    const blob: EncryptedBlobV1 = {
      v: 1,
      alg: "A256GCM",
      iv: bytesToBase64(iv),
      ct: bytesToBase64(ciphertext),
    };

    await this.storage.set(this.recordKey, JSON.stringify(blob));
  }

  public async clear(): Promise<void> {
    await this.storage.delete(this.recordKey);
  }
}
