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
- packages/\* - headless libraries containing all the business logic & state management for a wallet app
- packages/devtools/eslint — shared ESLint rules
- packages/devtools/typescript — shared tsconfig bases
- packages/xhdwallet — HD wallet crypto helpers (this is a modified version of @algorandfoundation/xhd-wallet-api which isn't babel friendly yet)

See workspace definition in [`pnpm-workspace.yaml`](pnpm-workspace.yaml).

## Tooling

- Task runner/cache: Turborepo (scripts in [`package.json`](package.json))
- Formatting: Prettier
- Linting: ESLint with shared config from [`packages/devtools/eslint`](packages/devtools/eslint/index.js)
- TypeScript project references via [`packages/devtools/typescript`](packages/devtools/typescript/package.json)

Generate all API clients (using Kubb):

```sh
pnpm run generate:all-apis
```

This writes typed clients, zod schemas, msw mocks, and React Query hooks under:

- generated/backend
- generated/algod
- generated/indexer

Note that our code does not directly use this generated code (yet) as the openapi specs are not up to scratch but the generated code can be used for reference or inspiration.

## Common commands (root)

```sh
pnpm build          # build across packages
pnpm test           # run tests with coverage
pnpm lint           # report linting errors
pnpm lint:fix       # fix linting errors
pnpm lint:copyright # add/update necessary copyright headers to any files that are missing them
pnpm lint:i18n      # report i18n errors
pnpm format         # format files
```

## Documentation

- [Architecture & State Management](docs/ARCHITECTURE.md)
- [Testing Guide](docs/TESTING.md)
- [Style Guide](docs/STYLE_GUIDE.md)
- [Security Best Practices](docs/SECURITY.md)

## Development patterns

- **Logic vs UI**: Keep business logic in `packages/*` and UI in `apps/mobile`.
- **State**: Use hooks/services to expose state; do not access stores directly in UI.
- **Backend**: Use generated React Query hooks; avoid direct API calls.
- **Platform**: Keep cross-platform logic in `wallet-core`; native glue in app.

For app-specific notes, see [`apps/mobile/README.md`](apps/mobile/README.md).
