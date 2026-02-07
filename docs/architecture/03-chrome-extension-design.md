# Chrome Extension Design (MV3)

## Responsibilities
- Implement dApp Connector API injection (`window.midnight[uuid]`)
- Request/approval UX and origin permissions
- Message bridge and long-lived state persistence

## Key Constraints
- Service worker lifecycle: persist state in IndexedDB, rehydrate on events.
- Use `MAIN` world for reliable injection.

