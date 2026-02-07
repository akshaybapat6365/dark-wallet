import * as ledger from "@midnight-ntwrk/ledger-v7";
import {
  ShieldedAddress,
  ShieldedCoinPublicKey,
  ShieldedEncryptionPublicKey,
} from "@midnight-ntwrk/wallet-sdk-address-format";
import { DustWallet } from "@midnight-ntwrk/wallet-sdk-dust-wallet";
import {
  type CombinedSwapOutputs,
  type CombinedTokenTransfer,
  WalletFacade,
} from "@midnight-ntwrk/wallet-sdk-facade";
import { HDWallet, Roles } from "@midnight-ntwrk/wallet-sdk-hd";
import { ShieldedWallet } from "@midnight-ntwrk/wallet-sdk-shielded";
import {
  InMemoryTransactionHistoryStorage,
  PublicKey,
  UnshieldedWallet,
  createKeystore,
} from "@midnight-ntwrk/wallet-sdk-unshielded-wallet";

import { apiError } from "../api/api_error.js";
import {
  type ConnectionStatus,
  type DesiredInput,
  type DesiredOutput,
  ErrorCodes,
  type HistoryEntry,
  type KeyMaterialProvider,
  type ProvingProvider,
  type SignDataOptions,
  type Signature,
  type TokenType,
} from "../api/types.js";
import { base64ToBytes } from "../encoding/base64.js";
import { hexToBytes } from "../encoding/hex.js";
import { fetchLatestLedgerParameters } from "./indexer.js";
import { resegmentIntentTx } from "./intent_segment.js";
import { deserializeFinalizedTx, deserializeUnboundTx, serializeTx } from "./tx_codec.js";
import { ConnectorZkConfigProvider } from "./zk_config_provider.js";

import { httpClientProvingProvider } from "@midnight-ntwrk/midnight-js-http-client-proof-provider";

type DustCostParameters = {
  additionalFeeOverhead: bigint;
  feeBlocksMargin: number;
};

type PersistedSdkState = {
  shieldedSerialized?: string;
  unshieldedSerialized?: string;
  dustSerialized?: string;
  unshieldedTxHistorySerialized?: string;
};

export type MidnightBackendConfig = {
  networkId: string;
  indexerUri: string;
  indexerWsUri?: string;
  proverServerUri?: string;
  substrateNodeUri: string;
  dustCostParameters?: DustCostParameters;
  persisted?: PersistedSdkState;
};

export type MidnightBackendSnapshot = Required<PersistedSdkState>;

function defaultDustCostParameters(): DustCostParameters {
  return { additionalFeeOverhead: 0n, feeBlocksMargin: 2 };
}

function toUtcTtl(msFromNow: number): Date {
  return new Date(Date.now() + msFromNow);
}

function decodeSignDataPayload(data: string, encoding: SignDataOptions["encoding"]): Uint8Array {
  if (encoding === "text") return new TextEncoder().encode(data);
  if (encoding === "base64") return base64ToBytes(data);
  // hex
  return hexToBytes(data);
}

function signDataPrefix(params: { origin: string; networkId: string }): Uint8Array {
  // Domain separation and context binding to avoid signatures being reinterpreted as something else.
  const text = [
    "Midnight Signed Message (Dark Wallet)",
    `origin:${params.origin}`,
    `network:${params.networkId}`,
    "",
  ].join("\n");
  return new TextEncoder().encode(text);
}

function concatBytes(a: Uint8Array, b: Uint8Array): Uint8Array {
  const out = new Uint8Array(a.length + b.length);
  out.set(a, 0);
  out.set(b, a.length);
  return out;
}

function mapBalances(input: Record<string, bigint>): Record<TokenType, bigint> {
  return Object.fromEntries(Object.entries(input).map(([k, v]) => [k as TokenType, v]));
}

function groupDesiredOutputs(outputs: DesiredOutput[]): CombinedTokenTransfer[] {
  const shielded: Array<{ type: ledger.RawTokenType; receiverAddress: string; amount: bigint }> =
    [];
  const unshielded: Array<{ type: ledger.RawTokenType; receiverAddress: string; amount: bigint }> =
    [];

  for (const o of outputs) {
    const t = o.type as unknown as ledger.RawTokenType;
    const x = { type: t, receiverAddress: o.recipient, amount: o.value };
    if (o.kind === "shielded") shielded.push(x);
    else unshielded.push(x);
  }

  const combined: CombinedTokenTransfer[] = [];
  if (shielded.length) combined.push({ type: "shielded", outputs: shielded });
  if (unshielded.length) combined.push({ type: "unshielded", outputs: unshielded });
  return combined;
}

function desiredInputsToCombined(inputs: DesiredInput[]): {
  shielded?: Record<ledger.RawTokenType, bigint>;
  unshielded?: Record<ledger.RawTokenType, bigint>;
} {
  const shielded: Record<string, bigint> = {};
  const unshielded: Record<string, bigint> = {};

  for (const i of inputs) {
    const bucket = i.kind === "shielded" ? shielded : unshielded;
    bucket[i.type] = (bucket[i.type] ?? 0n) + i.value;
  }

  const out: {
    shielded?: Record<ledger.RawTokenType, bigint>;
    unshielded?: Record<ledger.RawTokenType, bigint>;
  } = {};
  if (Object.keys(shielded).length)
    out.shielded = shielded as unknown as Record<ledger.RawTokenType, bigint>;
  if (Object.keys(unshielded).length)
    out.unshielded = unshielded as unknown as Record<ledger.RawTokenType, bigint>;
  return out;
}

export class MidnightBackend {
  private readonly config: MidnightBackendConfig;

  private readonly unshieldedSecretKey: Uint8Array;
  private readonly keystore: ReturnType<typeof createKeystore>;
  private readonly unshieldedPublicKey: ReturnType<typeof PublicKey.fromKeyStore>;

  private readonly shieldedSecretKeys: ledger.ZswapSecretKeys;
  private readonly dustSecretKey: ledger.DustSecretKey;

  private started = false;
  private facade: WalletFacade | null = null;
  private unshieldedTxHistory: InMemoryTransactionHistoryStorage | null = null;

  public constructor(params: {
    config: MidnightBackendConfig;
    masterSeed: Uint8Array;
  }) {
    this.config = params.config;

    const hd = HDWallet.fromSeed(params.masterSeed);
    if (hd.type !== "seedOk") {
      throw apiError(
        ErrorCodes.InternalError,
        "Failed to create HD wallet from masterSeed.",
        hd.error,
      );
    }

    const account0 = hd.hdWallet.selectAccount(0);
    const derived = account0
      .selectRoles([Roles.NightExternal, Roles.Dust, Roles.Zswap] as const)
      .deriveKeysAt(0);

    hd.hdWallet.clear();

    if (derived.type !== "keysDerived") {
      throw apiError(
        ErrorCodes.InternalError,
        `Key derivation failed (out of bounds roles: ${derived.roles.join(", ")}).`,
      );
    }

    this.unshieldedSecretKey = derived.keys[Roles.NightExternal];
    const dustSeed = derived.keys[Roles.Dust];
    const zswapSeed = derived.keys[Roles.Zswap];

    this.shieldedSecretKeys = ledger.ZswapSecretKeys.fromSeed(zswapSeed);
    this.dustSecretKey = ledger.DustSecretKey.fromSeed(dustSeed);

    this.keystore = createKeystore(this.unshieldedSecretKey, this.config.networkId);
    this.unshieldedPublicKey = PublicKey.fromKeyStore(this.keystore);
  }

  public connectionStatus(): ConnectionStatus {
    return { status: "connected", networkId: this.config.networkId };
  }

  public getUnshieldedAddress(): { unshieldedAddress: string } {
    return { unshieldedAddress: this.unshieldedPublicKey.address };
  }

  public signData(origin: string, data: string, options: SignDataOptions): Signature {
    if (options.keyType !== "unshielded") {
      throw apiError(ErrorCodes.InvalidRequest, `Unsupported keyType '${options.keyType}'.`);
    }

    const msg = decodeSignDataPayload(data, options.encoding);
    const payload = concatBytes(signDataPrefix({ origin, networkId: this.config.networkId }), msg);
    const sig = this.keystore.signData(payload);
    return { data, signature: sig, verifyingKey: this.unshieldedPublicKey.publicKey };
  }

  public provingProvider(keyMaterialProvider: KeyMaterialProvider): ProvingProvider {
    if (!this.config.proverServerUri) {
      throw apiError(
        ErrorCodes.InvalidRequest,
        "Wallet is not configured with a proving server URI.",
      );
    }

    const zkConfigProvider = new ConnectorZkConfigProvider(keyMaterialProvider);
    return httpClientProvingProvider(this.config.proverServerUri, zkConfigProvider);
  }

  private async ensureStarted(): Promise<WalletFacade> {
    if (this.started && this.facade) return this.facade;

    if (!this.config.proverServerUri) {
      throw apiError(
        ErrorCodes.InvalidRequest,
        "Missing proverServerUri. Shielded operations require a proof server.",
      );
    }

    // Dust wallet needs DUST parameters at creation time.
    const ledgerParams = await fetchLatestLedgerParameters({ indexerUri: this.config.indexerUri });
    const dustParams = ledgerParams.dust;

    const txHistoryStorage = this.config.persisted?.unshieldedTxHistorySerialized
      ? InMemoryTransactionHistoryStorage.fromSerialized(
          this.config.persisted.unshieldedTxHistorySerialized,
        )
      : new InMemoryTransactionHistoryStorage();

    const indexerClientConnection = {
      indexerHttpUrl: this.config.indexerUri,
      ...(this.config.indexerWsUri ? { indexerWsUrl: this.config.indexerWsUri } : {}),
    };

    const shieldedConfig = {
      networkId: this.config.networkId,
      indexerClientConnection,
      provingServerUrl: new URL(this.config.proverServerUri),
      relayURL: new URL(this.config.substrateNodeUri),
    } satisfies Parameters<typeof ShieldedWallet>[0];

    const unshieldedConfig = {
      networkId: this.config.networkId,
      indexerClientConnection,
      txHistoryStorage,
    } satisfies Parameters<typeof UnshieldedWallet>[0];

    const dustCostParameters = this.config.dustCostParameters ?? defaultDustCostParameters();
    const dustRuntimeConfig = {
      networkId: this.config.networkId,
      costParameters: dustCostParameters,
      indexerClientConnection,
      provingServerUrl: new URL(this.config.proverServerUri),
      relayURL: new URL(this.config.substrateNodeUri),
    };

    const shieldedWalletClass = ShieldedWallet(shieldedConfig);
    const shieldedWallet = this.config.persisted?.shieldedSerialized
      ? shieldedWalletClass.restore(this.config.persisted.shieldedSerialized)
      : shieldedWalletClass.startWithSecretKeys(this.shieldedSecretKeys);

    const unshieldedWalletClass = UnshieldedWallet(unshieldedConfig);
    const unshieldedWallet = this.config.persisted?.unshieldedSerialized
      ? unshieldedWalletClass.restore(this.config.persisted.unshieldedSerialized)
      : unshieldedWalletClass.startWithPublicKey(this.unshieldedPublicKey);

    const dustWalletClass = DustWallet(
      dustRuntimeConfig as unknown as Parameters<typeof DustWallet>[0],
    );
    const dustWallet = this.config.persisted?.dustSerialized
      ? dustWalletClass.restore(this.config.persisted.dustSerialized)
      : dustWalletClass.startWithSecretKey(this.dustSecretKey, dustParams);

    const facade = new WalletFacade(shieldedWallet, unshieldedWallet, dustWallet);
    await facade.start(this.shieldedSecretKeys, this.dustSecretKey);

    this.started = true;
    this.facade = facade;
    this.unshieldedTxHistory = txHistoryStorage;
    return facade;
  }

  public async stop(): Promise<void> {
    if (!this.facade) return;
    await this.facade.stop();
    this.facade = null;
    this.unshieldedTxHistory = null;
    this.started = false;
  }

  public async snapshot(): Promise<MidnightBackendSnapshot> {
    const facade = await this.ensureStarted();
    const [shieldedSerialized, unshieldedSerialized, dustSerialized] = await Promise.all([
      facade.shielded.serializeState(),
      facade.unshielded.serializeState(),
      facade.dust.serializeState(),
    ]);

    const unshieldedTxHistorySerialized = this.unshieldedTxHistory?.serialize() ?? "";
    return {
      shieldedSerialized,
      unshieldedSerialized,
      dustSerialized,
      unshieldedTxHistorySerialized,
    };
  }

  public async getShieldedBalances(): Promise<Record<TokenType, bigint>> {
    const facade = await this.ensureStarted();
    const s = await facade.waitForSyncedState();
    return mapBalances(s.shielded.balances as unknown as Record<string, bigint>);
  }

  public async getUnshieldedBalances(): Promise<Record<TokenType, bigint>> {
    const facade = await this.ensureStarted();
    const s = await facade.waitForSyncedState();
    return mapBalances(s.unshielded.balances as unknown as Record<string, bigint>);
  }

  public async getDustBalance(): Promise<{ cap: bigint; balance: bigint }> {
    const facade = await this.ensureStarted();
    const s = await facade.waitForSyncedState();
    const now = new Date();
    const balance = s.dust.walletBalance(now);
    const cap = s.dust.availableCoinsWithFullInfo(now).reduce((sum, info) => sum + info.maxCap, 0n);
    return { cap, balance };
  }

  public async getShieldedAddresses(): Promise<{
    shieldedAddress: string;
    shieldedCoinPublicKey: string;
    shieldedEncryptionPublicKey: string;
  }> {
    // Addresses are derivable without sync, but we still want shielded wallet initialized.
    const facade = await this.ensureStarted();
    const state = await facade.shielded.waitForSyncedState();

    const shieldedAddress = ShieldedAddress.codec
      .encode(this.config.networkId, state.address)
      .asString();
    const shieldedCoinPublicKey = ShieldedCoinPublicKey.codec
      .encode(this.config.networkId, state.coinPublicKey)
      .asString();
    const shieldedEncryptionPublicKey = ShieldedEncryptionPublicKey.codec
      .encode(this.config.networkId, state.encryptionPublicKey)
      .asString();

    return { shieldedAddress, shieldedCoinPublicKey, shieldedEncryptionPublicKey };
  }

  public async getDustAddress(): Promise<{ dustAddress: string }> {
    const facade = await this.ensureStarted();
    const state = await facade.dust.waitForSyncedState();
    return { dustAddress: state.dustAddress };
  }

  public async makeTransfer(desiredOutputs: DesiredOutput[]): Promise<{ tx: string }> {
    const facade = await this.ensureStarted();
    const recipe = await facade.transferTransaction(
      groupDesiredOutputs(desiredOutputs),
      { shieldedSecretKeys: this.shieldedSecretKeys, dustSecretKey: this.dustSecretKey },
      { ttl: toUtcTtl(30 * 60 * 1000), payFees: true },
    );

    const signed = await facade.signRecipe(recipe, (payload) => this.keystore.signData(payload));
    const finalized = await facade.finalizeRecipe(signed);
    return { tx: serializeTx(finalized) };
  }

  public async makeIntent(
    desiredInputs: DesiredInput[],
    desiredOutputs: DesiredOutput[],
    options: { intentId: number | "random"; payFees: boolean },
  ): Promise<{ tx: string }> {
    const facade = await this.ensureStarted();
    const combinedInputs = desiredInputsToCombined(desiredInputs);
    const combinedOutputs: CombinedSwapOutputs[] = groupDesiredOutputs(desiredOutputs);
    const recipe = await facade.initSwap(
      combinedInputs,
      combinedOutputs,
      { shieldedSecretKeys: this.shieldedSecretKeys, dustSecretKey: this.dustSecretKey },
      { ttl: toUtcTtl(30 * 60 * 1000), payFees: options.payFees },
    );

    // Intents are intentionally returned as UNPROVEN transactions for composition by the dApp.
    const tx = resegmentIntentTx(recipe.transaction, options.intentId);
    return { tx: serializeTx(tx) };
  }

  public async balanceUnsealedTransaction(txHex: string): Promise<{ tx: string }> {
    const facade = await this.ensureStarted();
    const tx = deserializeUnboundTx(txHex);
    const recipe = await facade.balanceUnboundTransaction(
      tx,
      { shieldedSecretKeys: this.shieldedSecretKeys, dustSecretKey: this.dustSecretKey },
      { ttl: toUtcTtl(30 * 60 * 1000) },
    );

    const signed = await facade.signRecipe(recipe, (payload) => this.keystore.signData(payload));
    const finalized = await facade.finalizeRecipe(signed);
    return { tx: serializeTx(finalized) };
  }

  public async balanceSealedTransaction(txHex: string): Promise<{ tx: string }> {
    const facade = await this.ensureStarted();
    const tx = deserializeFinalizedTx(txHex);
    const recipe = await facade.balanceFinalizedTransaction(
      tx,
      { shieldedSecretKeys: this.shieldedSecretKeys, dustSecretKey: this.dustSecretKey },
      { ttl: toUtcTtl(30 * 60 * 1000) },
    );

    const signed = await facade.signRecipe(recipe, (payload) => this.keystore.signData(payload));
    const finalized = await facade.finalizeRecipe(signed);
    return { tx: serializeTx(finalized) };
  }

  public async submitTransaction(txHex: string): Promise<void> {
    const facade = await this.ensureStarted();
    const tx = deserializeFinalizedTx(txHex);
    await facade.submitTransaction(tx);
  }

  public async getTxHistory(pageNumber: number, pageSize: number): Promise<HistoryEntry[]> {
    if (pageNumber < 0 || pageSize <= 0) {
      throw apiError(ErrorCodes.InvalidRequest, "Invalid pagination parameters.");
    }

    const facade = await this.ensureStarted();
    const s = await facade.waitForSyncedState();
    const txs = s.shielded.transactionHistory;

    const hashes = txs.map((t) => t.transactionHash());
    const dedup = [...new Set(hashes)];
    const start = pageNumber * pageSize;
    const slice = dedup.slice(start, start + pageSize);

    return slice.map((txHash) => ({
      txHash,
      txStatus: { status: "finalized", executionStatus: {} },
    }));
  }
}
