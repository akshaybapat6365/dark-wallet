import {
  type ProverKey,
  type VerifierKey,
  ZKConfigProvider,
  type ZKIR,
  createProverKey,
  createVerifierKey,
  createZKIR,
} from "@midnight-ntwrk/midnight-js-types";

import type { KeyMaterialProvider } from "../api/types.js";

export class ConnectorZkConfigProvider extends ZKConfigProvider<string> {
  private readonly inner: KeyMaterialProvider;

  public constructor(inner: KeyMaterialProvider) {
    super();
    this.inner = inner;
  }

  public async getZKIR(circuitId: string): Promise<ZKIR> {
    return createZKIR(await this.inner.getZKIR(circuitId));
  }

  public async getProverKey(circuitId: string): Promise<ProverKey> {
    return createProverKey(await this.inner.getProverKey(circuitId));
  }

  public async getVerifierKey(circuitId: string): Promise<VerifierKey> {
    return createVerifierKey(await this.inner.getVerifierKey(circuitId));
  }
}
