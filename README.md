# Pera Monorepo

A concise guide to structure, setup, and daily commands.

## Prerequisites

- Node.js >= 22 and pnpm 10.28+ (see packageManager in [`package.json`](package.json))
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
pnpm localnet:fund --new-quantum 100  # create + fund a throwaway quantum (post-quantum) account (prints seed hex)
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

### Quantum (post-quantum) verification

```sh
pnpm localnet:quantum-check
```

Runs an end-to-end check of a quantum-signed transaction against LocalNet:
derives a Falcon-1024 address, funds it, builds a payment with a PQ-raised
fee, checks the assembled PQ envelope against algosdk's own PQ signer, then
broadcasts and waits for confirmation.

The **default** LocalNet (`algod` 4.7.4-stable) has no `pqsig` support, so the
script reports **PENDING** (exit 0) once broadcast is rejected for that reason
specifically; any other failure reports FAIL (non-zero exit).

To get a real **PASS: confirmed in round N**, point LocalNet at a
`pqsig`-capable node. Two things are needed together — the `master` image and a
genesis whose consensus enables Falcon-1024 (v42, inherited by `future`). Edit
`~/.config/algokit/sandbox/`:

```sh
# docker-compose.yml          -> image: algorand/algod:master
# algod_network_template.json -> add  "ConsensusProtocol": "future",  under "Genesis"
docker compose -f ~/.config/algokit/sandbox/docker-compose.yml down -v
docker compose -f ~/.config/algokit/sandbox/docker-compose.yml up -d
pnpm localnet:quantum-check   # -> PASS: confirmed in round N
```

The check talks to `localhost:4001` directly, so it needs no app config. To
exercise the **app** against this node, re-enter the custom network in
**Settings → Developer → Node Settings** — recreating the containers changes the
genesis hash, so the previously saved config no longer matches.

Note `algokit localnet start/reset` **rewrites both files**, so re-apply the two
edits after running either. `algorand/algod:nightly` is not a substitute — it
still lacks `pqsig`. See `docs/QUANTUM_PQ_INTEGRATION.md` (PQ-023).

> **This swap kills the indexer, but the app still works.** Consensus v42 also
> enables `LoadTracking`, adding a `ld` field to the block header. The published
> `conduit-localnet` and `indexer` images predate it and cannot decode it, so
> conduit dies with `error decoding block for round 1: msgpack decode error ...
key ld` and the indexer stays pinned at round 0
> (`docker logs algokit_sandbox_conduit`; `curl -s localhost:8980/health`).
> Balances, the asset list and sending are **unaffected** — `account-syncer.ts`
> reads them from algod, and holdings only fall back to the indexer past algod's
> resource cap (the large-account path). Expect indexer-backed surfaces
> (transaction history, large accounts) to be empty. If a balance reads 0.00 on
> LocalNet, it is far more likely a stale `account_balances` row than the
> indexer: pull-to-refresh does NOT re-fetch when a row already exists, so
> **relaunch the app** after funding.

### Conformance suite

`pnpm test:conformance` runs the app's builders/keystore/signing/error-handling
code against this LocalNet instead of a mock — see
[`docs/LOCALNET_CONFORMANCE.md`](docs/LOCALNET_CONFORMANCE.md) for what it
proves, prerequisites, and known gaps.

## Workspace layout

```
pera-react-native/
├── apps/
│   ├── mobile/              # React Native app (UI layer)
│   └── extension/           # Chrome MV3 browser extension
├── packages/                # Headless business logic (one per domain)
│   ├── accounts/            # Account management and state
│   ├── assets/              # Asset management
│   ├── blockchain/          # Algorand-specific code (node/indexer)
│   ├── config/              # Configuration and environment
│   ├── database/            # Local persistence
│   ├── devtools/            # Development tools
│   │   └── tsconfig/        # Shared TypeScript configuration
│   ├── kms/                 # Key Management System integration
│   ├── shared/              # Common utilities, types, and models
│   ├── signing/             # Signing pipeline
│   ├── walletconnect/       # WalletConnect integration
│   └── …                    # contacts, swaps, staking, card, nfd, …
├── extensions/              # Platform adapters behind one interface
│   ├── platform/            # The platform contract
│   ├── platform-react-native/ # React Native implementation
│   ├── platform-chrome/     # Chrome implementation
│   ├── provider/            # `getProvider()` accessor used by packages
│   └── …                    # ledger-*, keystore-chrome, passkey-autofill
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
pnpm test           # run all tests (unit + integration)
pnpm test:unit      # run unit tests only
pnpm test:coverage  # run tests with coverage
pnpm lint           # report lint/type-aware issues
pnpm lint:fix       # auto-fix lint/type-aware issues
pnpm lint:copyright # add/update necessary copyright headers
pnpm lint:i18n      # report i18n errors
pnpm format         # format files
pnpm fallow         # report unused code, circular deps, duplication
```

## Dead code, cycles & duplication (fallow)

[fallow](https://github.com/fallow-rs/fallow) finds cross-module unused exports/files/types/dependencies, circular dependencies, and code duplication — gaps neither Oxlint nor `tsc` cover. Config lives in [`.fallowrc.jsonc`](.fallowrc.jsonc).

It runs in CI as an **advisory, non-blocking** job (`Dead Code` in [`pre-merge.yml`](.github/workflows/pre-merge.yml)) — findings appear in the job summary but never fail a PR. The plan is to triage the existing findings, then ratchet specific rules to blocking with a `--baseline` so only new findings fail. Removals should be done in reviewed PRs, not via `fallow fix`.

## Documentation

- [Architecture & State Management](docs/ARCHITECTURE.md)
- [Folder Structure Guide](docs/FOLDER_STRUCTURE.md)
- [Naming Conventions](docs/NAMING_CONVENTIONS.md)
- [Testing Guide](docs/TESTING.md)
- [Style Guide](docs/STYLE_GUIDE.md)
- [Security Best Practices](docs/SECURITY.md)
- [Performance Guidelines](docs/PERFORMANCE.md)
- [Pera Card](docs/PERA_CARD.md)
- [Contributing Guide](CONTRIBUTING.md)

For app-specific notes, see [`apps/mobile/README.md`](apps/mobile/README.md).
