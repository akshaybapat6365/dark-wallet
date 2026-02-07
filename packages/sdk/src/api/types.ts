// Mirror the dApp Connector API surface (v3.0.0) closely, but keep this SDK independent.

export type TokenType = string;

export type DesiredOutput = {
  address: string;
  tokenType: TokenType;
  amount: bigint;
};

export type DesiredInput = {
  tokenType: TokenType;
  amount: bigint;
};

export type SignDataOptions = {
  key: "unshielded" | "shielded" | "dust" | string;
  format: "raw" | "hex" | "base64" | string;
};

export type KeyMaterialProvider = unknown;
export type ProvingProvider = unknown;

export type ShieldedBalance = {
  getShieldedBalances(): Promise<Record<TokenType, bigint>>;
};

export type UnshieldedBalance = {
  getUnshieldedBalances(): Promise<Record<TokenType, bigint>>;
};

export type DustBalance = {
  getDustBalance(): Promise<bigint>;
};

export type ShieldedAddress = {
  getShieldedAddresses(): Promise<{
    shieldedAddress: string;
    shieldedCoinPublicKey: string;
    shieldedEncryptionPublicKey: string;
  }>;
};

export type UnshieldedAddress = {
  getUnshieldedAddress(): Promise<{ unshieldedAddress: string }>;
};

export type DustAddress = {
  getDustAddress(): Promise<{ dustAddress: string }>;
};

export type InitActions = {
  balanceUnsealedTransaction(tx: string): Promise<{ tx: string }>;
  balanceSealedTransaction(tx: string): Promise<{ tx: string }>;
  makeTransfer(desiredOutputs: DesiredOutput[]): Promise<{ tx: string }>;
  makeIntent(
    desiredInputs: DesiredInput[],
    desiredOutputs: DesiredOutput[],
    options: { intentId: number | "random"; payFees: boolean },
  ): Promise<{ tx: string }>;
  signData(data: string, options: SignDataOptions): Promise<{ signature: string }>;
};

export type Configuration = {
  getConfiguration(): Promise<{
    indexerUri: string;
    indexerWsUri: string;
    proverServerUri: string;
    substrateNodeUri: string;
    networkId: string;
  }>;
};

export type ProvingDelegation = {
  getProvingProvider(_keyMaterialProvider: KeyMaterialProvider): ProvingProvider;
};

export type Submission = {
  submitTransaction(tx: string): Promise<{ txHash: string }>;
};

export type HistoryEntry = {
  txHash: string;
  timestamp: string;
};

export type TxHistory = {
  getTxHistory(pageNumber: number, pageSize: number): Promise<HistoryEntry[]>;
};

export type ConnectedAPI = ShieldedBalance &
  UnshieldedBalance &
  DustBalance &
  ShieldedAddress &
  UnshieldedAddress &
  DustAddress &
  InitActions &
  Configuration &
  ProvingDelegation &
  Submission &
  TxHistory;

export type InitialAPI = {
  rdns: string;
  name: string;
  icon: string;
  apiVersion: string;
  connect: (networkId: string) => Promise<ConnectedAPI>;
};
