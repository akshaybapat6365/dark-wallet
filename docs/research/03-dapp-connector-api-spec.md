# Midnight dApp Connector API Specification

> **Dark Wallet Research Document 03**
> Last updated: February 2026
> Sources: midnightntwrk/midnight-dapp-connector-api SPECIFICATION.md, npm package docs

---

## 1. Overview

The dApp Connector API defines how **wallets communicate with dApps** in the Midnight ecosystem. It is analogous to Cardano's CIP-30 and Ethereum's EIP-1193, but designed specifically for Midnight's privacy model.

**Package**: `@midnight-ntwrk/dapp-connector-api` v3.0.0
**Source**: [github.com/midnightntwrk/midnight-dapp-connector-api](https://github.com/midnightntwrk/midnight-dapp-connector-api)

---

## 2. Discovery & Injection

### 2.1 Global Object

Wallets inject their API into the global `window.midnight` object:

```typescript
declare global {
  interface Window {
    midnight?: {
      [key: string]: InitialAPI; // Key is a freshly-generated UUIDv4
    };
  }
}
```

### 2.2 Initial API

```typescript
type InitialAPI = {
  /** Wallet identifier in reverse DNS notation (e.g., `com.darkwallet.app`) */
  rdns: string;
  /** Wallet name for display */
  name: string;
  /** Wallet icon as URL or base64 data URL */
  icon: string;
  /** Semver version of the API package implemented */
  apiVersion: string;
  /** Connect to wallet, hinting desired network id */
  connect: (networkId: string) => Promise<ConnectedAPI>;
};
```

### 2.3 Security Requirements for Injection

1. **First wallet** must install `window.midnight` as non-writable, non-configurable:

   ```javascript
   Object.defineProperty(window, "midnight", {
     value: Object.create(null),
     writable: false,
     configurable: false,
   });
   ```

2. **Each wallet** installs under a freshly-generated UUIDv4:

   ```javascript
   Object.defineProperty(window.midnight, uuid(), {
     configurable: false,
     writable: false,
     enumerable: true,
     value: Object.freeze(initialAPI),
   });
   ```

3. Both `InitialAPI` and `ConnectedAPI` objects must be **frozen** (non-extensible, non-writable, non-configurable)

4. **XSS prevention**: DApps must render icons only via `<img>` tags (prevent JS-in-SVG) and display names via `Text` nodes

---

## 3. Connection Flow

```
┌──────────────┐     connect(networkId)     ┌──────────────────┐
│              │ ──────────────────────────► │                  │
│   DApp       │                            │   Wallet         │
│              │ ◄────────────────────────── │                  │
│              │     Promise<ConnectedAPI>   │  (may show user  │
│              │                            │   approval dialog)│
└──────────────┘                            └──────────────────┘
```

**Connection rules:**

- DApp MUST provide a network ID (e.g., `"mainnet"`, `"preprod"`)
- Wallet MUST reject if it can't connect to the requested network
- Wallet MAY ask user for permission scope
- Wallet SHOULD handle multiple `connect()` calls for reconnection

---

## 4. Connected API

### 4.1 Balance Queries

```typescript
type ShieldedBalance = {
  getShieldedBalances(): Promise<Record<TokenType, bigint>>;
};

type UnshieldedBalance = {
  getUnshieldedBalances(): Promise<Record<TokenType, bigint>>;
};

type DustBalance = {
  getDustBalance(): Promise<bigint>;
};
```

### 4.2 Address Queries

```typescript
type ShieldedAddress = {
  getShieldedAddresses(): Promise<{
    shieldedAddress: string;
    shieldedCoinPublicKey: string;
    shieldedEncryptionPublicKey: string;
  }>;
};

type UnshieldedAddress = {
  getUnshieldedAddress(): Promise<{ unshieldedAddress: string }>;
};

type DustAddress = {
  getDustAddress(): Promise<{ dustAddress: string }>;
};
```

### 4.3 Transaction Operations

```typescript
type InitActions = {
  /** Balance an unsealed transaction (add inputs/outputs, pay fees) */
  balanceUnsealedTransaction(tx: string): Promise<{ tx: string }>;

  /** Balance a sealed transaction (with proofs and signatures) */
  balanceSealedTransaction(tx: string): Promise<{ tx: string }>;

  /** Create a transfer transaction */
  makeTransfer(desiredOutputs: DesiredOutput[]): Promise<{ tx: string }>;

  /** Create an unbalanced intent (e.g., for atomic swaps) */
  makeIntent(
    desiredInputs: DesiredInput[],
    desiredOutputs: DesiredOutput[],
    options: { intentId: number | "random"; payFees: boolean },
  ): Promise<{ tx: string }>;

  /** Sign data with specified key and format */
  signData(
    data: string,
    options: SignDataOptions,
  ): Promise<{ signature: string }>;
};
```

### 4.4 Configuration Access

```typescript
type Configuration = {
  getConfiguration(): Promise<{
    indexerUri: string; // Indexer HTTP URI
    indexerWsUri: string; // Indexer WebSocket URI
    proverServerUri: string; // Proof server URI
    substrateNodeUri: string; // Substrate node URI
    networkId: string; // Connected network
  }>;
};
```

**Privacy implication**: DApps should respect the wallet's configured endpoints. This is critical because users may run their own infrastructure for privacy.

### 4.5 Proving Delegation

```typescript
type ProvingDelegation = {
  /** Get a proving provider from the wallet */
  getProvingProvider(keyMaterialProvider: KeyMaterialProvider): ProvingProvider;
};
```

DApps can delegate ZK proof generation to the wallet, which may use its own proof server configuration.

### 4.6 Transaction Submission

```typescript
type Submission = {
  /** Submit a balanced, signed transaction to the network */
  submitTransaction(tx: string): Promise<{ txHash: string }>;
};
```

### 4.7 Transaction History

```typescript
type TxHistory = {
  getTxHistory(pageNumber: number, pageSize: number): Promise<HistoryEntry[]>;
};
```

---

## 5. Key Design Decisions

### 5.1 Separation of Concerns

The API deliberately keeps wallet and dApp responsibilities separate:

| Wallet Responsibility       | DApp Responsibility                  |
| --------------------------- | ------------------------------------ |
| Key management              | Contract call preparation            |
| Coin selection (UTxO)       | Defining desired transaction effects |
| Fee payment                 | Providing contract-specific logic    |
| Input/output balancing      | User interface                       |
| Proof generation (optional) |                                      |

**Critical**: No API provides direct access to shielded coins or unshielded UTxOs. DApps ask the wallet to prepare transactions with specific effects via `balanceTransaction`, `makeTransfer`, or `makeIntent`.

### 5.2 Data Signing Security

All signed data is prefixed with `midnight_signed_message:<size>:` to prevent transaction replay attacks. The wallet must never sign raw data that could be misinterpreted as a transaction.

### 5.3 CAIP-372 Compatibility

The InitialAPI structure (with `rdns`, `name`, `icon`, `apiVersion`) is compatible with the **draft CAIP-372** specification for chain-agnostic wallet discovery.

---

## 6. Implications for Dark Wallet

### What Dark Wallet Must Implement

1. **InitialAPI injection**: Install `window.midnight.{uuid}` with:
   - `rdns: "io.darkwallet.app"` (or similar)
   - `name: "Dark Wallet"`
   - `icon: <base64 or hosted URL>`
   - `apiVersion: "3.0.0"`

2. **Full ConnectedAPI**: All balance, address, transaction, configuration, and proving methods

3. **Embedded SDK variant**: For the SDK, instead of `window.midnight` injection, expose the same `ConnectedAPI` interface programmatically:

   ```typescript
   const wallet = DarkWallet.create({ network: "mainnet" });
   const api: ConnectedAPI = await wallet.connect();
   ```

4. **Multiple dApp support**: Track connected state per tab/origin (for extension) or per integration (for SDK)

---

## References

1. Midnight dApp Connector API. _SPECIFICATION.md_. [github.com/midnightntwrk/midnight-dapp-connector-api](https://github.com/midnightntwrk/midnight-dapp-connector-api/blob/main/SPECIFICATION.md)
2. `@midnight-ntwrk/dapp-connector-api` v3.0.0. [npmjs.com](https://www.npmjs.com/package/@midnight-ntwrk/dapp-connector-api)
3. Cardano CIP-30. _Cardano dApp-Wallet Web Bridge_. [cips.cardano.org/cip/CIP-0030](https://cips.cardano.org/cip/CIP-0030)
4. CAIP-372 (Draft). _Multi-Provider Discovery_. [github.com/ChainAgnostic/CAIPs/pull/372](https://github.com/ChainAgnostic/CAIPs/pull/372)
