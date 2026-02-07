import { apiError } from "../api/api_error.js";
import { type ConnectedAPI, ErrorCodes, type WalletConnectedAPI } from "../api/types.js";
import {
  createEncryptedPrivateStateBackup,
  openEncryptedPrivateStateBackup,
} from "../backup/epsb.js";
import { DarkWalletError } from "../errors.js";
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

const STATE_RECORD_KEY = "dark-wallet:state";

type EncryptedStateBlobV1 = {
  v: 1;
  alg: "A256GCM";
  iv: string;
  ct: string;
};

function isEncryptedStateBlobV1(x: unknown): x is EncryptedStateBlobV1 {
  if (!x || typeof x !== "object") return false;
  const o = x as Partial<EncryptedStateBlobV1>;
  return o.v === 1 && o.alg === "A256GCM" && typeof o.iv === "string" && typeof o.ct === "string";
}

export function createDarkWallet(config: DarkWalletConfig): DarkWallet {
  const events = new Emitter<WalletEvents>();
  const storage = config.storage ?? defaultStorage();
  const permissionController = config.permissions ?? new AllowAllPermissionController();
  const defaultOrigin = config.origin ?? "embedded";

  let destroyed = false;
  let connectedNetworkId: string | null = null;
  let activeBackend: MidnightBackend | null = null;
  let store: EncryptedStateStore | null = null;
  let state: WalletStateV3 | null = null;
  let initPromise: Promise<void> | null = null;

  // Serialize encrypted state writes across concurrent dApp calls.
  let stateLock: Promise<void> = Promise.resolve();
  async function withStateLock<T>(fn: () => Promise<T>): Promise<T> {
    const prev = stateLock;
    let release!: () => void;
    stateLock = new Promise<void>((resolve) => {
      release = resolve;
    });
    await prev;
    try {
      return await fn();
    } finally {
      release();
    }
  }

  function assertNotDestroyed() {
    if (destroyed) throw apiError(ErrorCodes.Disconnected, "DarkWallet is destroyed.");
  }

  function assertConnected() {
    if (!connectedNetworkId) throw apiError(ErrorCodes.Disconnected, "Not connected.");
  }

  async function ensureInitialized(): Promise<void> {
    assertNotDestroyed();
    if (store && state && activeBackend) return;

    if (!initPromise) {
      initPromise = (async () => {
        const rootSecret = await config.keyMaterial.getRootSecret();
        const { masterSeed, storageKey } = await deriveWalletKeys(rootSecret);
        store = new EncryptedStateStore({ storage, storageKey, recordKey: STATE_RECORD_KEY });

        const loaded = await store.load<WalletStateV1 | WalletStateV2 | WalletStateV3>();
        const nextState = normalizeState(loaded ?? undefined, {
          networkId: config.endpoints.networkId,
        });
        if (!loaded || loaded.schemaVersion !== nextState.schemaVersion) {
          await store.save(nextState);
        }

        state = nextState;
        activeBackend = new MidnightBackend({
          masterSeed,
          config: {
            networkId: config.endpoints.networkId,
            indexerUri: config.endpoints.indexerUri,
            ...(config.endpoints.indexerWsUri
              ? { indexerWsUri: config.endpoints.indexerWsUri }
              : {}),
            ...(config.endpoints.proverServerUri
              ? { proverServerUri: config.endpoints.proverServerUri }
              : {}),
            substrateNodeUri: config.endpoints.substrateNodeUri,
            persisted: nextState.walletSdkState,
          },
        });

        events.emit("ready", { walletId: nextState.walletId, networkId: nextState.networkId });
      })();
    }

    await initPromise;
  }

  async function exportEncryptedBackup(password: string): Promise<string> {
    assertNotDestroyed();
    const raw = await storage.get(STATE_RECORD_KEY);
    if (!raw) {
      throw new DarkWalletError("ERR_STORAGE", "No encrypted state found to back up.");
    }
    return createEncryptedPrivateStateBackup({ password, encryptedStateBlobJson: raw });
  }

  async function importEncryptedBackup(password: string, backupJson: string): Promise<void> {
    assertNotDestroyed();
    if (connectedNetworkId) {
      throw new DarkWalletError(
        "ERR_INVALID_CONFIG",
        "Cannot import a backup while connected. Call destroy() and recreate the wallet instance.",
      );
    }

    const { encryptedStateBlobJson } = await openEncryptedPrivateStateBackup({
      password,
      backupJson,
    });

    let parsed: unknown;
    try {
      parsed = JSON.parse(encryptedStateBlobJson) as unknown;
    } catch (err) {
      throw new DarkWalletError("ERR_STORAGE", "Backup did not contain a valid state blob.", err);
    }
    if (!isEncryptedStateBlobV1(parsed)) {
      throw new DarkWalletError(
        "ERR_STORAGE",
        "Backup did not contain a supported encrypted state blob.",
      );
    }

    await storage.set(STATE_RECORD_KEY, encryptedStateBlobJson);
  }

  async function connect(_networkId: string, options?: { origin?: string }): Promise<ConnectedAPI> {
    assertNotDestroyed();

    if (_networkId !== config.endpoints.networkId) {
      throw apiError(
        ErrorCodes.InvalidRequest,
        `Unsupported networkId '${_networkId}'. This wallet instance is configured for '${config.endpoints.networkId}'.`,
      );
    }

    await ensureInitialized();
    if (!store || !state || !activeBackend) {
      throw apiError(ErrorCodes.InternalError, "Wallet initialization failed.");
    }

    const store0 = store;
    connectedNetworkId = state.networkId;
    const origin = options?.origin ?? defaultOrigin;
    const backend = activeBackend;

    async function persistBackendState(): Promise<void> {
      const snap = await backend.snapshot();
      const walletId = await withStateLock(async () => {
        if (!state) throw apiError(ErrorCodes.InternalError, "Missing wallet state.");
        state = { ...state, walletSdkState: snap };
        await store0.save(state);
        return state.walletId;
      });
      events.emit("stateChanged", { walletId });
    }

    async function ensurePermissions(methods: WalletMethodName[]): Promise<void> {
      assertNotDestroyed();
      assertConnected();

      if (methods.length === 0) return;

      const missing = await withStateLock(async () => {
        if (!state) throw apiError(ErrorCodes.InternalError, "Missing wallet state.");
        const record = state.permissions[origin];
        const existing = record?.methods ?? [];
        return methods.filter((m) => !existing.includes(m));
      });
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

      const walletId = await withStateLock(async () => {
        if (!state) throw apiError(ErrorCodes.InternalError, "Missing wallet state.");
        const record = state.permissions[origin];
        const existing = record?.methods ?? [];
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
        await store0.save(state);
        return state.walletId;
      });
      events.emit("stateChanged", { walletId });
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
        return backend.signData(origin, _data, _options);
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

    return api;
  }

  return {
    rdns: config.rdns ?? "io.darkwallet.app",
    name: config.name ?? "Dark Wallet",
    icon: config.icon ?? "",
    apiVersion: config.apiVersion ?? "4.0.0",
    connect,
    events,
    exportEncryptedBackup,
    importEncryptedBackup,
    async destroy() {
      destroyed = true;
      connectedNetworkId = null;
      await activeBackend?.stop();
      activeBackend = null;
    },
  };
}
