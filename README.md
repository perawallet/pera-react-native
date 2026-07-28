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
pnpm localnet:use         # point the app's testnet slot at LocalNet
pnpm localnet:fund --new 100   # create + fund a throwaway account (prints mnemonic)
pnpm localnet:fund --new-quantum 100  # create + fund a throwaway quantum (post-quantum) account (prints seed hex)
pnpm ios                  # or: pnpm android — app now talks to LocalNet as "testnet"
pnpm localnet:unset       # restore live endpoints
pnpm localnet:stop        # stop the LocalNet
```

LocalNet reuses the **testnet** slot; **mainnet stays on live infrastructure**.
`localnet:use` fetches the node's genesis hash live, so re-run it after any
`pnpm localnet:reset`.

### Quantum (post-quantum) verification

```sh
pnpm localnet:quantum-check
```

Runs an end-to-end check of a quantum-signed transaction against LocalNet:
derives a Falcon-1024 address, funds it, builds a payment with a PQ-raised
fee, and asserts the assembled signed-transaction bytes match algosdk's own
PQ signer byte-for-byte, before attempting to broadcast it. As of this
writing **no public algod accepts the `pqsig` field** — LocalNet's 4.7.4-stable
included — so the script reports **PENDING** (exit 0) rather than PASS once
broadcast is rejected for that reason specifically; any other failure reports
FAIL (non-zero exit). It converts to a true PASS, unchanged, the day a
pqsig-capable algod ships.

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
