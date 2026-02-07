import { DarkWalletError } from "../errors.js";

function getCryptoOrThrow(): Crypto {
  // Node 19+/modern browsers expose WebCrypto as global crypto.
  const cryptoObj = globalThis.crypto;
  if (!cryptoObj?.subtle) throw new DarkWalletError("ERR_UNSUPPORTED", "WebCrypto is required.");
  return cryptoObj;
}

function toArrayBufferU8(bytes: Uint8Array): Uint8Array<ArrayBuffer> {
  // Typed arrays may be backed by SharedArrayBuffer in some environments/types; WebCrypto
  // typings generally require ArrayBuffer-backed views.
  if (bytes.buffer instanceof ArrayBuffer) return bytes as Uint8Array<ArrayBuffer>;
  return new Uint8Array(bytes) as Uint8Array<ArrayBuffer>;
}

export function randomBytes(length: number): Uint8Array {
  const cryptoObj = getCryptoOrThrow();
  const out = new Uint8Array(length);
  cryptoObj.getRandomValues(out);
  return out;
}

export async function hkdfSha256(params: {
  ikm: Uint8Array;
  salt: Uint8Array;
  info: Uint8Array;
  length: number;
}): Promise<Uint8Array> {
  const cryptoObj = getCryptoOrThrow();
  try {
    const ikm = toArrayBufferU8(params.ikm);
    const salt = toArrayBufferU8(params.salt);
    const info = toArrayBufferU8(params.info);

    const key = await cryptoObj.subtle.importKey("raw", ikm, "HKDF", false, ["deriveBits"]);
    const bits = await cryptoObj.subtle.deriveBits(
      {
        name: "HKDF",
        hash: "SHA-256",
        salt,
        info,
      },
      key,
      params.length * 8,
    );
    return new Uint8Array(bits);
  } catch (err) {
    throw new DarkWalletError("ERR_CRYPTO", "HKDF failed.", err);
  }
}

export async function aesGcmEncrypt(params: {
  key: Uint8Array; // 32 bytes
  plaintext: Uint8Array;
  aad?: Uint8Array;
}): Promise<{ iv: Uint8Array; ciphertext: Uint8Array }> {
  const cryptoObj = getCryptoOrThrow();
  const iv = toArrayBufferU8(randomBytes(12));
  try {
    const keyBytes = toArrayBufferU8(params.key);
    const plaintext = toArrayBufferU8(params.plaintext);

    const cryptoKey = await cryptoObj.subtle.importKey(
      "raw",
      keyBytes,
      { name: "AES-GCM" },
      false,
      ["encrypt"],
    );

    const alg: AesGcmParams = { name: "AES-GCM", iv };
    if (params.aad) alg.additionalData = toArrayBufferU8(params.aad);

    const ct = await cryptoObj.subtle.encrypt(alg, cryptoKey, plaintext);
    return { iv, ciphertext: new Uint8Array(ct) };
  } catch (err) {
    throw new DarkWalletError("ERR_CRYPTO", "AES-GCM encrypt failed.", err);
  }
}

export async function aesGcmDecrypt(params: {
  key: Uint8Array; // 32 bytes
  iv: Uint8Array;
  ciphertext: Uint8Array;
  aad?: Uint8Array;
}): Promise<Uint8Array> {
  const cryptoObj = getCryptoOrThrow();
  try {
    const keyBytes = toArrayBufferU8(params.key);
    const iv = toArrayBufferU8(params.iv);
    const ciphertext = toArrayBufferU8(params.ciphertext);

    const cryptoKey = await cryptoObj.subtle.importKey(
      "raw",
      keyBytes,
      { name: "AES-GCM" },
      false,
      ["decrypt"],
    );

    const alg: AesGcmParams = { name: "AES-GCM", iv };
    if (params.aad) alg.additionalData = toArrayBufferU8(params.aad);

    const pt = await cryptoObj.subtle.decrypt(alg, cryptoKey, ciphertext);
    return new Uint8Array(pt);
  } catch (err) {
    throw new DarkWalletError("ERR_CRYPTO", "AES-GCM decrypt failed.", err);
  }
}
