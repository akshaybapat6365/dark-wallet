# ADR-002: Transaction String Encoding Is `hex(Transaction.serialize())`

Status: Accepted  
Date: 2026-02-07

## Context
The connector API surface represents transactions as `tx: string`.

`@midnight-ntwrk/ledger-v7` exposes multiple string-ish representations (notably `toString()`), but those are not guaranteed to be stable or parseable for transport. The only stable transport format is the byte serialization.

## Decision
Any `tx: string` accepted/returned by Dark Wallet connector methods is:
- `hex(Transaction.serialize())`

This includes `makeTransfer`, `makeIntent`, `balanceUnsealedTransaction`, `balanceSealedTransaction`, and `submitTransaction`.

## Consequences
- Transactions roundtrip reliably across contexts (web app, extension, Node).
- Debug output should be derived from deserializing the bytes and calling `toString()` on the resulting object, not by treating the connector string as a human format.

