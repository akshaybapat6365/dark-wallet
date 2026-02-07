// Single source of truth: use the upstream dApp Connector API types directly.
//
// This SDK is not a "wrapper" for Midnight; it is an implementation of the connector surface.
// Keeping types in sync via imports prevents drift.

export { ErrorCodes } from "@midnight-ntwrk/dapp-connector-api";

export type {
  APIError,
  Configuration,
  ConnectedAPI,
  ConnectionStatus,
  DesiredInput,
  DesiredOutput,
  ErrorCode,
  ExecutionStatus,
  HintUsage,
  HistoryEntry,
  InitialAPI,
  KeyMaterialProvider,
  ProvingProvider,
  SignDataOptions,
  Signature,
  TokenType,
  TxStatus,
  WalletConnectedAPI,
} from "@midnight-ntwrk/dapp-connector-api";
