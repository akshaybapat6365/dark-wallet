import { describe, expect, it } from "vitest";

import { aesGcmDecrypt, aesGcmEncrypt, hkdfSha256 } from "../src/crypto/webcrypto.js";

describe("crypto", () => {
  it("hkdfSha256 derives deterministic output", async () => {
    const ikm = new TextEncoder().encode("root-secret");
    const salt = new TextEncoder().encode("salt");
    const info = new TextEncoder().encode("info");

    const out1 = await hkdfSha256({ ikm, salt, info, length: 32 });
    const out2 = await hkdfSha256({ ikm, salt, info, length: 32 });

    expect(out1).toEqual(out2);
    expect(out1).toHaveLength(32);
  });

  it("aes-gcm encrypt/decrypt roundtrip", async () => {
    const key = new Uint8Array(32).fill(7);
    const plaintext = new TextEncoder().encode("hello");
    const aad = new TextEncoder().encode("aad");

    const { iv, ciphertext } = await aesGcmEncrypt({ key, plaintext, aad });
    const decrypted = await aesGcmDecrypt({ key, iv, ciphertext, aad });

    expect(new TextDecoder().decode(decrypted)).toBe("hello");
  });

  it("aes-gcm rejects tampered ciphertext", async () => {
    const key = new Uint8Array(32).fill(9);
    const plaintext = new TextEncoder().encode("hello");
    const { iv, ciphertext } = await aesGcmEncrypt({ key, plaintext });

    const tampered = new Uint8Array(ciphertext);
    tampered[0] = (tampered[0] ?? 0) ^ 0xff;

    await expect(aesGcmDecrypt({ key, iv, ciphertext: tampered })).rejects.toBeTruthy();
  });
});
