# Shared

Base types, utilities and models used across the app and the other packages.

- `src/api/` holds the query clients and HTTP utilities, including
  `createFetchClient()`, the network-aware ky wrapper.
- `src/models/` holds the base types and domain models.
- `src/utils/` holds the shared utilities.
- `src/test-handlers.ts` is the test-only MSW barrel; production code never imports it.
