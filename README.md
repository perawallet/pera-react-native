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
# Set up Git hooks (pre-commit and pre-push)
pnpm run setup
# First time iOS only
(cd apps/mobile/ios && bundle install && bundle exec pod install)
```

> **Note:** The `pnpm run setup` command installs Git hooks that automatically run linting, formatting, copyright checks before commits, and tests before pushes.

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
- packages/* - headless libraries containing all the business logic & state management for a wallet app
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
- API codegen: Kubb with configs [`backend-kubb.config.ts`](backend-kubb.config.ts), [`algod-kubb.config.ts`](algod-kubb.config.ts), [`indexer-kubb.config.ts`](indexer-kubb.config.ts); specs live in [`specs/`](specs/backend-openapi.json) (note that the openapi specs are not up to scratch and so generated code is used for reference/inspiration only)

Generate all API clients:

```sh
pnpm run generate:all-apis
```

This writes typed clients, zod schemas, msw mocks, and React Query hooks under:

- generated/backend
- generated/algod
- generated/indexer

Note that our code does not directly use this generated code as the openapi specs are not up to scratch but the generated code can be used for reference or inspiration.

## Common commands (root)

```sh
pnpm build          # build across packages
pnpm test           # run tests with coverage
pnpm lint           # report linting errors
pnpm lint:fix       # fix linting errors
pnpm lint:copyright # add/update necessary copyright headers to any files that are missing them
pnpm format         # format files
```

## Development patterns

- Do not call backends directly in the app; use generated React Query hooks from one of the wallet-core packages.  Ideally even wrap these in further hooks that perform as services doing state updates, etc.
- Do not expose the zustand store directly to the app.  Use hooks/services to update/expose state.
- Keep cross-platform logic in wallet-core; keep native/platform glue and UI in the app.
- Follow shared lint/format; run CI-equivalent locally via the commands above.

For app-specific notes, see [`apps/mobile/README.md`](apps/mobile/README.md) and for library details see [`packages/**`](packages/).
