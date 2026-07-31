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
# First time setup or to regenerate native projects
pnpm --filter mobile expo:prebuild
```

> **Note:** The `pnpm run setup` command installs Git hooks that automatically run linting, formatting, copyright checks before commits, and tests before pushes.

## Build the packages

```sh
pnpm build
```

This will build all packages in the monorepo and write out any generated configuration.

### 1. Start Metro

In one terminal start Metro:

```sh
pnpm mobile:start
```

### 2. Run on device / simulator

In another terminal run a platform target:

```sh
# iOS
pnpm ios

# Android
pnpm android
```

Tip: you can also run these from the app folder:

```sh
pnpm -C apps/mobile start|ios|android
```

### Clean Rebuilds

If you need to regenerate native projects from scratch:

```sh
pnpm -C apps/mobile expo:prebuild:clean
```

## Building packages

Workspace packages in `packages/*` are built to `dist/` folders. The Turbo configuration automatically builds packages before running the mobile app or tests, so **no manual build step is required** for most development.

> [!NOTE]
> During local development, the Metro bundler is configured to resolve packages directly from their `src/index.ts` files. This means you do not need to run a manual build to see your changes reflected in the app.

For active package development with hot-reloading:

```sh
# Watch mode - rebuilds packages on file changes (useful for editors/tests)
pnpm dev:packages
```

To manually build all packages:

```sh
pnpm build:packages
```

## Local development against LocalNet

Run a local Algorand node and point the app at it instead of live networks.

Prerequisites: Docker (running) and the AlgoKit CLI
(`brew install algorandfoundation/tap/algokit`).

```sh
pnpm localnet             # start the LocalNet (algod :4001, indexer :8980, kmd :4002)
pnpm localnet:fund --new 100   # create + fund a throwaway account (prints mnemonic)
pnpm ios                  # or: pnpm android
pnpm localnet:stop        # stop the LocalNet
```

Point the app at it from **Settings → Developer → Node Settings → Custom
network**. Selecting it opens a sheet for the algod and indexer URLs, their
optional tokens, and the genesis hash and ID — **Fetch from node** fills the
genesis values in for you. **Save and switch** applies the config at runtime:
no rebuild, no env rewrite, and MainNet/TestNet are untouched.

Two things to watch:

- On a **physical device**, `localhost` resolves to the device, not your
  machine. Use the host's LAN address (e.g. `http://192.168.1.50:4001`).
- `pnpm localnet:reset` regenerates the genesis hash, so re-enter the custom
  config afterwards.

## Workspace layout

```
pera-react-native/
├── apps/
│   └── mobile/              # React Native app (UI layer)
├── packages/                # Headless business logic packages
│   ├── accounts/            # Account management and state
│   ├── assets/              # Asset management
│   ├── blockchain/          # Algorand-specific code (node/indexer)
│   ├── config/              # Configuration and environment
│   ├── contacts/            # Contact management
│   ├── currencies/          # Currency formatting and preferences
│   ├── devtools/            # Development tools
│   │   └── tsconfig/        # Shared TypeScript configuration
│   ├── kms/                 # Key Management System integration
│   ├── platform-integration/# Platform abstraction layer
│   ├── polling/             # Background polling logic
│   ├── settings/            # User settings and preferences
│   ├── shared/              # Common utilities, types, and models
│   ├── swaps/               # Token swap functionality
│   ├── walletconnect/       # WalletConnect integration
│   └── xhdwallet/           # HD wallet crypto helpers
├── tools/                   # Development and CI scripts
├── specs/                   # OpenAPI specifications
└── docs/                    # Project documentation
```

See workspace definition in [`pnpm-workspace.yaml`](pnpm-workspace.yaml).

## Tooling

- Task runner/cache: Turborepo (scripts in [`package.json`](package.json))
- Formatting: oxfmt
- Linting: Oxlint via root config [`.oxlintrc.json`](.oxlintrc.json)
- Dead code / cycles / duplication: fallow via [`.fallowrc.jsonc`](.fallowrc.jsonc)
- TypeScript project references via [`packages/devtools/tsconfig`](packages/devtools/tsconfig)

## Common commands (root)

```sh
pnpm build          # build all packages
pnpm build:packages # build only workspace packages
pnpm dev:packages   # watch mode for package development
pnpm test           # run tests with coverage
pnpm lint           # report lint/type-aware issues
pnpm lint:fix       # auto-fix lint/type-aware issues
pnpm lint:copyright # add/update necessary copyright headers
pnpm lint:i18n      # report i18n errors
pnpm format         # format files
pnpm fallow         # report unused code, circular deps, duplication
```

## Dead code, cycles & duplication (fallow)

[fallow](https://github.com/fallow-rs/fallow) finds cross-module unused exports/files/types/dependencies, circular dependencies, and code duplication — gaps neither Oxlint nor `tsc` cover. Config lives in [`.fallowrc.jsonc`](.fallowrc.jsonc).

It runs in CI as an **advisory, non-blocking** job (`Dead Code (advisory)` in [`pre-merge.yml`](.github/workflows/pre-merge.yml)) — findings appear in the job summary but never fail a PR. The plan is to triage the existing findings, then ratchet specific rules to blocking with a `--baseline` so only new findings fail. Removals should be done in reviewed PRs, not via `fallow fix`.

## Documentation

- [Architecture & State Management](docs/ARCHITECTURE.md)
- [Folder Structure Guide](docs/FOLDER_STRUCTURE.md)
- [Naming Conventions](docs/NAMING_CONVENTIONS.md)
- [Testing Guide](docs/TESTING.md)
- [Style Guide](docs/STYLE_GUIDE.md)
- [Security Best Practices](docs/SECURITY.md)
- [Performance Guidelines](docs/PERFORMANCE.md)
- [Contributing Guide](CONTRIBUTING.md)

For app-specific notes, see [`apps/mobile/README.md`](apps/mobile/README.md).
