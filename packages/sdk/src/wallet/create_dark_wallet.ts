import type { ConnectedAPI } from "../api/types.js";
import { notImplemented } from "../errors.js";
import { Emitter } from "../events/emitter.js";
import { EncryptedStateStore } from "../state/encrypted_state_store.js";
import { type WalletState, createInitialState } from "../state/schema.js";
import { InMemoryStorageProvider } from "../storage/in_memory.js";
import { IndexedDbStorageProvider } from "../storage/indexed_db.js";
import type { StorageProvider } from "../storage/types.js";
import { deriveWalletKeys } from "./derive_keys.js";
import type { DarkWallet, DarkWalletConfig, WalletEvents } from "./types.js";

function defaultStorage(): StorageProvider {
  if (IndexedDbStorageProvider.isAvailable()) return new IndexedDbStorageProvider();
  return new InMemoryStorageProvider();
}

export function createDarkWallet(config: DarkWalletConfig): DarkWallet {
  const events = new Emitter<WalletEvents>();
  const storage = config.storage ?? defaultStorage();

  let destroyed = false;

  async function connect(_networkId: string): Promise<ConnectedAPI> {
    if (destroyed) throw new Error("DarkWallet is destroyed.");

    const rootSecret = await config.keyMaterial.getRootSecret();
    const { storageKey } = await deriveWalletKeys(rootSecret);
    const store = new EncryptedStateStore({ storage, storageKey });

    let state = await store.load<WalletState>();
    if (!state) {
      state = createInitialState({ networkId: config.endpoints.networkId });
      await store.save(state);
    }

    events.emit("ready", { walletId: state.walletId, networkId: state.networkId });

    // Skeleton ConnectedAPI: start with configuration; expand in follow-up commits.
    const api: ConnectedAPI = {
      async getShieldedBalances() {
        throw notImplemented("getShieldedBalances not implemented yet.");
      },
      async getUnshieldedBalances() {
        throw notImplemented("getUnshieldedBalances not implemented yet.");
      },
      async getDustBalance() {
        throw notImplemented("getDustBalance not implemented yet.");
      },
      async getShieldedAddresses() {
        throw notImplemented("getShieldedAddresses not implemented yet.");
      },
      async getUnshieldedAddress() {
        throw notImplemented("getUnshieldedAddress not implemented yet.");
      },
      async getDustAddress() {
        throw notImplemented("getDustAddress not implemented yet.");
      },
      async balanceUnsealedTransaction(_tx: string) {
        throw notImplemented("balanceUnsealedTransaction not implemented yet.");
      },
      async balanceSealedTransaction(_tx: string) {
        throw notImplemented("balanceSealedTransaction not implemented yet.");
      },
      async makeTransfer(_desiredOutputs) {
        throw notImplemented("makeTransfer not implemented yet.");
      },
      async makeIntent(_desiredInputs, _desiredOutputs, _options) {
        throw notImplemented("makeIntent not implemented yet.");
      },
      async signData(_data: string, _options) {
        throw notImplemented("signData not implemented yet.");
      },
      async getConfiguration() {
        return {
          indexerUri: config.endpoints.indexerUri,
          indexerWsUri: config.endpoints.indexerWsUri ?? "",
          proverServerUri: config.endpoints.proverServerUri,
          substrateNodeUri: config.endpoints.substrateNodeUri,
          networkId: config.endpoints.networkId,
        };
      },
      getProvingProvider(_keyMaterialProvider) {
        throw notImplemented("getProvingProvider not implemented yet.");
      },
      async submitTransaction(_tx: string) {
        throw notImplemented("submitTransaction not implemented yet.");
      },
      async getTxHistory(_pageNumber: number, _pageSize: number) {
        throw notImplemented("getTxHistory not implemented yet.");
      },
    };

    // Persisting state updates will be introduced once we have real wallet actions.
    void store;

    return api;
  }

  return {
    rdns: config.rdns ?? "io.darkwallet.app",
    name: config.name ?? "Dark Wallet",
    icon: config.icon ?? "",
    apiVersion: config.apiVersion ?? "3.0.0",
    connect,
    events,
    async destroy() {
      destroyed = true;
    },
  };
}
