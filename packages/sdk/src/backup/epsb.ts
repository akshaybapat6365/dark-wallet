import { scrypt } from "@noble/hashes/scrypt.js";

import { aesGcmDecrypt, aesGcmEncrypt, randomBytes } from "../crypto/webcrypto.js";
import { base64ToBytes, bytesToBase64 } from "../encoding/base64.js";
import { DarkWalletError } from "../errors.js";

export type EncryptedPrivateStateBackupV1 = {
  v: 1;
  kdf: {
    name: "scrypt";
    salt: string; // base64
    N: number;
    r: number;
    p: number;
    dkLen: number;
  };
  alg: "A256GCM";
  iv: string; // base64
  ct: string; // base64
  createdAt: string; // ISO
};

const AAD = new TextEncoder().encode("dark-wallet:epsb:v1");
const DEFAULT_KDF = { N: 32768, r: 8, p: 1, dkLen: 32 };

function assertValidPassword(password: string): void {
  if (password.length < 8) {
    throw new DarkWalletError("ERR_INVALID_CONFIG", "Backup password must be at least 8 chars.");
  }
}

function isEncryptedPrivateStateBackupV1(x: unknown): x is EncryptedPrivateStateBackupV1 {
  if (!x || typeof x !== "object") return false;
  const o = x as Partial<EncryptedPrivateStateBackupV1>;
  return (
    o.v === 1 &&
    o.alg === "A256GCM" &&
    !!o.kdf &&
    o.kdf.name === "scrypt" &&
    typeof o.kdf.salt === "string" &&
    typeof o.kdf.N === "number" &&
    typeof o.kdf.r === "number" &&
    typeof o.kdf.p === "number" &&
    typeof o.kdf.dkLen === "number" &&
    typeof o.iv === "string" &&
    typeof o.ct === "string" &&
    typeof o.createdAt === "string"
  );
}

function deriveBackupKey(password: string, salt: Uint8Array, kdf = DEFAULT_KDF): Uint8Array {
  try {
    return scrypt(password, salt, kdf);
  } catch (err) {
    throw new DarkWalletError("ERR_CRYPTO", "Failed to derive backup key.", err);
  }
}

export async function createEncryptedPrivateStateBackup(params: {
  password: string;
  encryptedStateBlobJson: string;
}): Promise<string> {
  assertValidPassword(params.password);

  const salt = randomBytes(16);
  const key = deriveBackupKey(params.password, salt);
  const plaintext = new TextEncoder().encode(params.encryptedStateBlobJson);

  const { iv, ciphertext } = await aesGcmEncrypt({ key, plaintext, aad: AAD });

  const blob: EncryptedPrivateStateBackupV1 = {
    v: 1,
    kdf: { name: "scrypt", salt: bytesToBase64(salt), ...DEFAULT_KDF },
    alg: "A256GCM",
    iv: bytesToBase64(iv),
    ct: bytesToBase64(ciphertext),
    createdAt: new Date().toISOString(),
  };

  return JSON.stringify(blob);
}

export async function openEncryptedPrivateStateBackup(params: {
  password: string;
  backupJson: string;
}): Promise<{ encryptedStateBlobJson: string }> {
  assertValidPassword(params.password);

  let parsed: unknown;
  try {
    parsed = JSON.parse(params.backupJson) as unknown;
  } catch (err) {
    throw new DarkWalletError("ERR_STORAGE", "Invalid backup JSON.", err);
  }

  if (!isEncryptedPrivateStateBackupV1(parsed)) {
    throw new DarkWalletError("ERR_STORAGE", "Unsupported backup format.");
  }

  const salt = base64ToBytes(parsed.kdf.salt);
  const key = deriveBackupKey(params.password, salt, {
    N: parsed.kdf.N,
    r: parsed.kdf.r,
    p: parsed.kdf.p,
    dkLen: parsed.kdf.dkLen,
  });

  const iv = base64ToBytes(parsed.iv);
  const ct = base64ToBytes(parsed.ct);
  const plaintext = await aesGcmDecrypt({ key, iv, ciphertext: ct, aad: AAD });

  try {
    return { encryptedStateBlobJson: new TextDecoder().decode(plaintext) };
  } catch (err) {
    throw new DarkWalletError("ERR_STORAGE", "Failed to decode backup plaintext.", err);
  }
}
