import { DarkWalletError } from "../errors.js";

function isHexChar(code: number): boolean {
  return (
    (code >= 48 && code <= 57) || // 0-9
    (code >= 65 && code <= 70) || // A-F
    (code >= 97 && code <= 102) // a-f
  );
}

export function bytesToHex(bytes: Uint8Array): string {
  const hex: string[] = [];
  for (const b of bytes) hex.push(b.toString(16).padStart(2, "0"));
  return hex.join("");
}

export function hexToBytes(hex: string): Uint8Array {
  let s = hex.trim();
  if (s.startsWith("0x") || s.startsWith("0X")) s = s.slice(2);

  if (s.length === 0) return new Uint8Array();
  if (s.length % 2 !== 0) {
    throw new DarkWalletError("ERR_INVALID_CONFIG", "Hex string must have even length.");
  }
  for (let i = 0; i < s.length; i += 1) {
    if (!isHexChar(s.charCodeAt(i))) {
      throw new DarkWalletError("ERR_INVALID_CONFIG", "Invalid hex string.");
    }
  }

  const out = new Uint8Array(s.length / 2);
  for (let i = 0; i < s.length; i += 2) {
    out[i / 2] = Number.parseInt(s.slice(i, i + 2), 16);
  }
  return out;
}
