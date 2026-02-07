import { hkdfSha256 } from "../crypto/webcrypto.js";

const SALT = new TextEncoder().encode("dark-wallet:hkdf-salt:v0");

export async function deriveWalletKeys(rootSecret: Uint8Array): Promise<{
  masterSeed: Uint8Array;
  storageKey: Uint8Array;
}> {
  const masterSeed = await hkdfSha256({
    ikm: rootSecret,
    salt: SALT,
    info: new TextEncoder().encode("dark-wallet:master-seed:v0"),
    length: 32,
  });

  const storageKey = await hkdfSha256({
    ikm: rootSecret,
    salt: SALT,
    info: new TextEncoder().encode("dark-wallet:storage-key:v0"),
    length: 32,
  });

  return { masterSeed, storageKey };
}
