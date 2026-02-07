type EncryptedBlobV1 = {
  v: 1;
  alg: "A256GCM";
  iv: string; // base64
  ct: string; // base64
};

const STORAGE_KEY = "dw:root-secret:v1";
const AAD = new TextEncoder().encode("dark-wallet:extension-root-secret:v1");

function randomBytes(length: number): Uint8Array {
  const out = new Uint8Array(length);
  crypto.getRandomValues(out);
  return out;
}

function bytesToBase64(bytes: Uint8Array): string {
  let binary = "";
  for (let i = 0; i < bytes.length; i++) {
    const b = bytes[i];
    if (b === undefined) continue;
    binary += String.fromCharCode(b);
  }
  return btoa(binary);
}

function base64ToBytes(b64: string): Uint8Array<ArrayBuffer> {
  const binary = atob(b64);
  const out = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) out[i] = binary.charCodeAt(i);
  return out as Uint8Array<ArrayBuffer>;
}

function toArrayBufferU8(bytes: Uint8Array): Uint8Array<ArrayBuffer> {
  if (bytes.buffer instanceof ArrayBuffer) return bytes as Uint8Array<ArrayBuffer>;
  return new Uint8Array(bytes) as Uint8Array<ArrayBuffer>;
}

async function sha256Bytes(input: Uint8Array): Promise<Uint8Array> {
  const digest = await crypto.subtle.digest("SHA-256", toArrayBufferU8(input));
  return new Uint8Array(digest);
}

async function deviceKeyBytes(): Promise<Uint8Array> {
  const text = `dark-wallet:device-key:v1:${chrome.runtime.id}`;
  return sha256Bytes(new TextEncoder().encode(text));
}

async function aesGcmEncrypt(params: {
  key: Uint8Array;
  plaintext: Uint8Array;
}): Promise<{ iv: Uint8Array; ciphertext: Uint8Array }> {
  const iv = toArrayBufferU8(randomBytes(12));
  const key = await crypto.subtle.importKey(
    "raw",
    toArrayBufferU8(params.key),
    { name: "AES-GCM" },
    false,
    ["encrypt"],
  );
  const ct = await crypto.subtle.encrypt(
    { name: "AES-GCM", iv, additionalData: AAD },
    key,
    toArrayBufferU8(params.plaintext),
  );
  return { iv, ciphertext: new Uint8Array(ct) };
}

async function aesGcmDecrypt(params: {
  key: Uint8Array;
  iv: Uint8Array;
  ciphertext: Uint8Array;
}): Promise<Uint8Array> {
  const key = await crypto.subtle.importKey(
    "raw",
    toArrayBufferU8(params.key),
    { name: "AES-GCM" },
    false,
    ["decrypt"],
  );
  const pt = await crypto.subtle.decrypt(
    { name: "AES-GCM", iv: toArrayBufferU8(params.iv), additionalData: AAD },
    key,
    toArrayBufferU8(params.ciphertext),
  );
  return new Uint8Array(pt);
}

function isEncryptedBlobV1(x: unknown): x is EncryptedBlobV1 {
  if (!x || typeof x !== "object") return false;
  const o = x as Partial<EncryptedBlobV1>;
  return o.v === 1 && o.alg === "A256GCM" && typeof o.iv === "string" && typeof o.ct === "string";
}

export async function getOrCreateRootSecret(): Promise<Uint8Array> {
  const res = await chrome.storage.local.get(STORAGE_KEY);
  const raw = res[STORAGE_KEY] as unknown;

  const keyBytes = await deviceKeyBytes();

  if (raw) {
    if (!isEncryptedBlobV1(raw)) throw new Error("Invalid vault blob.");
    const iv = base64ToBytes(raw.iv);
    const ct = base64ToBytes(raw.ct);
    const pt = await aesGcmDecrypt({ key: keyBytes, iv, ciphertext: ct });
    if (pt.length !== 32) throw new Error("Invalid root secret length.");
    return pt;
  }

  const secret = randomBytes(32);
  const { iv, ciphertext } = await aesGcmEncrypt({ key: keyBytes, plaintext: secret });
  const blob: EncryptedBlobV1 = {
    v: 1,
    alg: "A256GCM",
    iv: bytesToBase64(iv),
    ct: bytesToBase64(ciphertext),
  };
  await chrome.storage.local.set({ [STORAGE_KEY]: blob });
  return secret;
}
