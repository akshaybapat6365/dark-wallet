import type { KeyMaterialProvider } from "./types.js";

export class StaticKeyMaterialProvider implements KeyMaterialProvider {
  public readonly secret: Uint8Array;

  public constructor(secret: Uint8Array) {
    this.secret = new Uint8Array(secret);
  }

  public async getRootSecret(): Promise<Uint8Array> {
    return new Uint8Array(this.secret);
  }
}
