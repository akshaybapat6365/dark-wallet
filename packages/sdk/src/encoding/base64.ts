export function bytesToBase64(bytes: Uint8Array): string {
  // Node fast-path.
  if (typeof Buffer !== "undefined") return Buffer.from(bytes).toString("base64");

  // Browser: chunked to avoid stack/arg limits.
  let binary = "";
  for (let i = 0; i < bytes.length; i++) {
    const b = bytes[i];
    if (b === undefined) continue;
    binary += String.fromCharCode(b);
  }
  // biome-ignore lint/suspicious/noExplicitAny: browser-only global
  return (globalThis as any).btoa(binary);
}

export function base64ToBytes(b64: string): Uint8Array<ArrayBuffer> {
  if (typeof Buffer !== "undefined") {
    const buf = Buffer.from(b64, "base64");
    // Ensure a clean ArrayBuffer-backed view (avoid SharedArrayBuffer typing issues).
    return new Uint8Array(
      buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength),
    ) as Uint8Array<ArrayBuffer>;
  }

  // biome-ignore lint/suspicious/noExplicitAny: browser-only global
  const binary: string = (globalThis as any).atob(b64);
  const out = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) out[i] = binary.charCodeAt(i);
  return out as Uint8Array<ArrayBuffer>;
}
