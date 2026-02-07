import { apiError } from "../api/api_error.js";
import { type ConnectedAPI, ErrorCodes, type WalletConnectedAPI } from "../api/types.js";
import { Emitter } from "../events/emitter.js";
import { MidnightBackend } from "../midnight/backend.js";
import { AllowAllPermissionController, type WalletMethodName } from "../permissions/types.js";
import { EncryptedStateStore } from "../state/encrypted_state_store.js";
import {
  type WalletStateV1,
  type WalletStateV2,
  type WalletStateV3,
  normalizeState,
} from "../state/schema.js";
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
  const permissionController = config.permissions ?? new AllowAllPermissionController();
  const origin = config.origin ?? "embedded";

  let destroyed = false;
  let connectedNetworkId: string | null = null;
  let activeBackend: MidnightBackend | null = null;

  function assertNotDestroyed() {
    if (destroyed) throw apiError(ErrorCodes.Disconnected, "DarkWallet is destroyed.");
  }

  function assertConnected() {
    if (!connectedNetworkId) throw apiError(ErrorCodes.Disconnected, "Not connected.");
  }

  async function connect(_networkId: string): Promise<ConnectedAPI> {
    assertNotDestroyed();

    if (_networkId !== config.endpoints.networkId) {
      throw apiError(
        ErrorCodes.InvalidRequest,
        `Unsupported networkId '${_networkId}'. This wallet instance is configured for '${config.endpoints.networkId}'.`,
      );
    }

    const rootSecret = await config.keyMaterial.getRootSecret();
    const { masterSeed, storageKey } = await deriveWalletKeys(rootSecret);
    const store = new EncryptedStateStore({ storage, storageKey });

    const loaded = await store.load<WalletStateV1 | WalletStateV2 | WalletStateV3>();
    let state = normalizeState(loaded ?? undefined, { networkId: config.endpoints.networkId });
    if (!loaded || loaded.schemaVersion !== state.schemaVersion) await store.save(state);

    events.emit("ready", { walletId: state.walletId, networkId: state.networkId });
    connectedNetworkId = state.networkId;

    const backend = new MidnightBackend({
      origin,
      masterSeed,
      config: {
        networkId: config.endpoints.networkId,
        indexerUri: config.endpoints.indexerUri,
        ...(config.endpoints.indexerWsUri ? { indexerWsUri: config.endpoints.indexerWsUri } : {}),
        ...(config.endpoints.proverServerUri
          ? { proverServerUri: config.endpoints.proverServerUri }
          : {}),
        substrateNodeUri: config.endpoints.substrateNodeUri,
        persisted: state.walletSdkState,
      },
    });
    activeBackend = backend;

    async function persistBackendState(): Promise<void> {
      const snap = await backend.snapshot();
      state = { ...state, walletSdkState: snap };
      await store.save(state);
      events.emit("stateChanged", { walletId: state.walletId });
    }

    async function ensurePermissions(methods: WalletMethodName[]): Promise<void> {
      assertNotDestroyed();
      assertConnected();

      if (methods.length === 0) return;

      const record = state.permissions[origin];
      const existing = record?.methods ?? [];
      const missing = methods.filter((m) => !existing.includes(m));
      if (missing.length === 0) return;

      const { granted } = await permissionController.request({ origin, methods: missing });

      const grantedSet = new Set(granted);
      const denied = missing.filter((m) => !grantedSet.has(m));
      if (denied.length > 0) {
        throw apiError(
          ErrorCodes.PermissionRejected,
          `Permission rejected for: ${denied.join(", ")}`,
        );
      }

      const now = new Date().toISOString();
      const next: WalletMethodName[] = [...new Set([...existing, ...granted])];
      state = {
        ...state,
        permissions: {
          ...state.permissions,
          [origin]: record
            ? { ...record, methods: next, updatedAt: now }
            : { methods: next, createdAt: now, updatedAt: now },
        },
      };
      await store.save(state);
      events.emit("stateChanged", { walletId: state.walletId });
    }

    // Skeleton ConnectedAPI: start with config/permissions/status; expand in follow-up commits.
    const api: ConnectedAPI = {
      async getShieldedBalances() {
        assertConnected();
        await ensurePermissions(["getShieldedBalances"]);
        const res = await backend.getShieldedBalances();
        await persistBackendState();
        return res;
      },
      async getUnshieldedBalances() {
        assertConnected();
        await ensurePermissions(["getUnshieldedBalances"]);
        const res = await backend.getUnshieldedBalances();
        await persistBackendState();
        return res;
      },
      async getDustBalance() {
        assertConnected();
        await ensurePermissions(["getDustBalance"]);
        const res = await backend.getDustBalance();
        await persistBackendState();
        return res;
      },
      async getShieldedAddresses() {
        assertConnected();
        await ensurePermissions(["getShieldedAddresses"]);
        const res = await backend.getShieldedAddresses();
        await persistBackendState();
        return res;
      },
      async getUnshieldedAddress() {
        assertConnected();
        await ensurePermissions(["getUnshieldedAddress"]);
        return backend.getUnshieldedAddress();
      },
      async getDustAddress() {
        assertConnected();
        await ensurePermissions(["getDustAddress"]);
        const res = await backend.getDustAddress();
        await persistBackendState();
        return res;
      },
      async balanceUnsealedTransaction(_tx: string) {
        assertConnected();
        await ensurePermissions(["balanceUnsealedTransaction"]);
        const res = await backend.balanceUnsealedTransaction(_tx);
        await persistBackendState();
        return res;
      },
      async balanceSealedTransaction(_tx: string) {
        assertConnected();
        await ensurePermissions(["balanceSealedTransaction"]);
        const res = await backend.balanceSealedTransaction(_tx);
        await persistBackendState();
        return res;
      },
      async makeTransfer(_desiredOutputs) {
        assertConnected();
        await ensurePermissions(["makeTransfer"]);
        const res = await backend.makeTransfer(_desiredOutputs);
        await persistBackendState();
        return res;
      },
      async makeIntent(_desiredInputs, _desiredOutputs, _options) {
        assertConnected();
        await ensurePermissions(["makeIntent"]);
        const res = await backend.makeIntent(_desiredInputs, _desiredOutputs, _options);
        await persistBackendState();
        return res;
      },
      async signData(_data: string, _options) {
        assertConnected();
        await ensurePermissions(["signData"]);
        return backend.signData(_data, _options);
      },
      async hintUsage(methodNames: Array<keyof WalletConnectedAPI>) {
        await ensurePermissions(methodNames as WalletMethodName[]);
      },
      async getConfiguration() {
        assertConnected();
        return {
          indexerUri: config.endpoints.indexerUri,
          indexerWsUri: config.endpoints.indexerWsUri ?? "",
          ...(config.endpoints.proverServerUri
            ? { proverServerUri: config.endpoints.proverServerUri }
            : {}),
          substrateNodeUri: config.endpoints.substrateNodeUri,
          networkId: config.endpoints.networkId,
        };
      },
      async getProvingProvider(_keyMaterialProvider) {
        assertConnected();
        await ensurePermissions(["getProvingProvider"]);
        return backend.provingProvider(_keyMaterialProvider);
      },
      async submitTransaction(_tx: string) {
        assertConnected();
        await ensurePermissions(["submitTransaction"]);
        await backend.submitTransaction(_tx);
        await persistBackendState();
      },
      async getTxHistory(_pageNumber: number, _pageSize: number) {
        assertConnected();
        await ensurePermissions(["getTxHistory"]);
        const res = await backend.getTxHistory(_pageNumber, _pageSize);
        await persistBackendState();
        return res;
      },
      async getConnectionStatus() {
        if (!connectedNetworkId) return { status: "disconnected" };
        return { status: "connected", networkId: connectedNetworkId };
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
    apiVersion: config.apiVersion ?? "4.0.0",
    connect,
    events,
    async destroy() {
      destroyed = true;
      connectedNetworkId = null;
      await activeBackend?.stop();
      activeBackend = null;
    },
  };
}
