# Pera Monorepo

A concise guide to structure, setup, and daily commands.

## Prerequisites

- Node.js >= 20 and pnpm 10.15+ (see packageManager in [`package.json`](package.json))
- iOS: Xcode 15+, CocoaPods via Bundler (Ruby), iOS Simulator
- Android: Android Studio + SDKs, JDK 17, emulator or device
- macOS: Watchman for fast reloads

## Install

```sh
pnpm install
# First time iOS only
(cd apps/mobile/ios && bundle install && bundle exec pod install)
```

## Run the mobile app

In one terminal start Metro:

```sh
pnpm --filter mobile start
```

In another terminal run a platform target:

```sh
# iOS
pnpm --filter mobile ios

# Android
pnpm --filter mobile android
```

Tip: you can also run these from the app folder:

```sh
pnpm -C apps/mobile start|ios|android
```

## Workspace layout

- apps/mobile — React Native app scaffold and screens
- packages/core — shared domain/services and generated API clients
    - src/api/generated/(backend|algod|indexer) — outputs from Kubb
    - src/services — slices of functionality (aka features)
    - src/config — per-environment config
    - src/store — shared state (uses zustand)
    - src/platform - a set of interfaces each platform will need to implement to provide platform specific implementations
- packages/eslint-config — shared ESLint rules
- packages/typescript-config — shared tsconfig bases
- packages/xhdwallet — HD wallet crypto helpers (this is a modified version of @algorandfoundation/xhd-wallet-api which isn't babel friendly)
- specs — OpenAPI specs used for generation

See workspace definition in [`pnpm-workspace.yaml`](pnpm-workspace.yaml).

## Tooling

- Task runner/cache: Turborepo (scripts in [`package.json`](package.json))
- Formatting: Prettier
- Linting: ESLint with shared config from [`packages/eslint-config`](packages/eslint-config/index.js)
- TypeScript project references via [`packages/typescript-config`](packages/typescript-config/package.json)
- API codegen: Kubb with configs [`backend-kubb.config.ts`](backend-kubb.config.ts), [`algod-kubb.config.ts`](algod-kubb.config.ts), [`indexer-kubb.config.ts`](indexer-kubb.config.ts); specs live in [`specs/`](specs/backend-openapi.json)

Generate or refresh all API clients:

```sh
pnpm run generate:all-apis
```

This writes typed clients, zod schemas, msw mocks, and React Query hooks under:

- packages/core/src/api/generated/backend
- packages/core/src/api/generated/algod
- packages/core/src/api/generated/indexer

Clients are wired to thin query clients in core, e.g. [`packages/core/src/api/backend-query-client.ts`](packages/core/src/api/backend-query-client.ts), [`packages/core/src/api/algod-query-client.ts`](packages/core/src/api/algod-query-client.ts), [`packages/core/src/api/indexer-query-client.ts`](packages/core/src/api/indexer-query-client.ts).

## Common commands (root)

```sh
pnpm build          # turbo run build across packages
pnpm test           # turbo run test -- --coverage
pnpm lint           # turbo run lint
pnpm lint:fix       # turbo run lint -- --fix
pnpm format         # prettier --write
```

## Development patterns

- Do not call backends directly in the app; use generated React Query hooks from core.
- Keep cross-platform logic in core; keep native/platform glue and UI in the app.
- Follow shared lint/format; run CI-equivalent locally via the commands above.
- Regenerate API clients whenever a spec in [`specs/`](specs/backend-openapi.json) changes.

For app-specific notes, see [`apps/mobile/README.md`](apps/mobile/README.md) and for library details see [`packages/core`](packages/core/src/index.ts).
