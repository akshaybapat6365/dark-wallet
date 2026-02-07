# ADR-001: Connector Types Are The Source Of Truth

Status: Accepted  
Date: 2026-02-07

## Context
Dark Wallet implements the Midnight dApp Connector API surface.

Historically, connector specs drift when projects copy types into local wrappers. That creates silent incompatibilities (especially across minor versions) and makes it unclear which behavior is expected by dApps.

## Decision
`@dark-wallet/sdk` imports and re-exports connector types directly from:
- `@midnight-ntwrk/dapp-connector-api@4.0.0`

In other words, the connector package is the type system authority. Dark Wallet implements the behavior behind those types.

## Consequences
- Type drift is prevented by construction.
- Upgrades are explicit: bumping the connector package version surfaces compile errors.
- Dark Wallet can still add its own internal types, but the public API surface stays connector-compatible.

