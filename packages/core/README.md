# Pera Core

Shared domain logic, typed API clients, and React Query hooks used by the app.

## What lives here

- Domain services and state under [packages/core/src/services](packages/core/src/services/index.ts)
- Typed API clients and hooks under generated folders (generated using kubb from openapi specs):
    - packages/core/src/api/generated/backend
    - packages/core/src/api/generated/algod
    - packages/core/src/api/generated/indexer
- Query clients and HTTP utilities:
    - [packages/core/src/api/backend-query-client.ts](packages/core/src/api/backend-query-client.ts)
    - [packages/core/src/api/algod-query-client.ts](packages/core/src/api/algod-query-client.ts)
    - [packages/core/src/api/indexer-query-client.ts](packages/core/src/api/indexer-query-client.ts)
    - [createFetchClient()](packages/core/src/api/query-client.ts:55) — network-aware ky wrapper
- Environment config in [packages/core/src/config](packages/core/src/config/main.ts)
- Shared state store (zustand) in [packages/core/src/store](packages/core/src/store/index.ts)
- Utilities in [packages/core/src/utils](packages/core/src/utils/index.ts)

## Build, test, lint

Run from the repo root:

```sh
pnpm --filter @perawallet/core build
pnpm --filter @perawallet/core test
pnpm --filter @perawallet/core test:watch
pnpm --filter @perawallet/core lint
```

## API codegen

OpenAPI specs are in [specs](specs/). Generate all clients:

```sh
pnpm run generate:all-apis
```

This writes types, zod schemas, msw mocks, and React Query hooks to:

- packages/core/src/api/generated/backend
- packages/core/src/api/generated/algod
- packages/core/src/api/generated/indexer

React Query hooks use the network-aware clients above and zod parsing configured in:

- [backend-kubb.config.ts](backend-kubb.config.ts)
- [algod-kubb.config.ts](algod-kubb.config.ts)
- [indexer-kubb.config.ts](indexer-kubb.config.ts)

## HTTP and network selection

- All HTTP goes through [createFetchClient()](packages/core/src/api/query-client.ts:55) which selects a ky client instance by current network.
- Network is sourced from the app store (see [packages/core/src/store](packages/core/src/store/index.ts)); clients are created in the query-client files above.
- Do not call fetch directly from services or the app; use generated hooks and the fetch client.

## Services and patterns

- Services expose a small surface area (stores plus hooks). Examples:
    - Accounts: [packages/core/src/services/accounts](packages/core/src/services/accounts/index.ts)
    - Assets: [packages/core/src/services/assets](packages/core/src/services/assets/index.ts)
    - Polling: [packages/core/src/services/polling](packages/core/src/services/polling/index.ts)
    - Notifications: [packages/core/src/services/notifications](packages/core/src/services/notifications/index.ts)
    - Remote config: [packages/core/src/services/remote-config](packages/core/src/services/remote-config/index.ts)
    - Storage: [packages/core/src/services/storage](packages/core/src/services/storage/index.ts)
- Keep domain logic here; UI/platform glue belongs in the app.
- Prefer selectors and typed helpers over ad-hoc object access.

## Using from the app

- Import public APIs via [packages/core/src/index.ts](packages/core/src/index.ts).
- The app wraps the tree in React Query's provider, see [QueryProvider()](apps/mobile/src/providers/QueryProvider.tsx:25); hooks will share [queryClient](apps/mobile/src/providers/QueryProvider.tsx:9).

## Testing

- Unit tests use Vitest; see existing specs under [packages/core/src/services/accounts/**tests**](packages/core/src/services/accounts/__tests__/hooks.accounts.test.ts).
- API layer can be tested with generated MSW handlers under each generated mocks folder.
- Run coverage from root: pnpm test

## Conventions

- TypeScript strictness; format with pnpm format at root.
- Regenerate clients when specs change.
- Keep modules tree-shakeable; avoid side effects in module top-level code.
