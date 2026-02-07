export interface KeyMaterialProvider {
  /**
   * Returns stable high-entropy root secret bytes used to derive:
   * - masterSeed (wallet derivation input)
   * - storageKey (AES-256-GCM encryption)
   */
  getRootSecret(): Promise<Uint8Array>;
}
