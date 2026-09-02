# Pera Monorepo

Structure, setup, and the commands you'll use daily.

## Prerequisites

- Node.js >= 22 and pnpm 10.28+ (see `packageManager` in [`package.json`](package.json))
- iOS: Xcode 15+, CocoaPods via Bundler (Ruby), iOS Simulator
- Android: Android Studio + SDKs, JDK 17, emulator or device
- macOS: Watchman for fast reloads

## Install

```sh
pnpm install
pnpm run setup                       # Git hooks: lint/format/copyright, then tests on push
pnpm --filter mobile expo:prebuild      # First run, or to regenerate native projects
```

## Run the app

Metro in one terminal:

```sh
pnpm mobile:start
```

A platform target in another:

```sh
pnpm ios
pnpm android
```

Both also work from the app folder: `pnpm -C apps/mobile start|ios|android`.

To regenerate native projects from scratch, `pnpm -C apps/mobile expo:prebuild:clean`.

## Building packages

Workspace packages in `packages/*` build to `dist/`. Turbo builds them before running the mobile app
or tests, so most development needs no manual build step.

> [!NOTE]
> In local development Metro resolves packages directly from their `src/index.ts`,
> so package changes show up in the app with no build.

```sh
pnpm build            # every package, plus generated configuration
pnpm build:packages   # workspace packages only
pnpm dev:packages     # watch mode, for editors and tests
```

## Local development against LocalNet

Run a local Algorand node and point the app at it instead of live networks. Needs Docker running and
the AlgoKit CLI (`brew install algorandfoundation/tap/algokit`).

```sh
pnpm localnet                          # start LocalNet (algod :4001, indexer :8980, kmd :4002)
pnpm localnet:fund --new 100           # create + fund a throwaway account (prints mnemonic)
pnpm localnet:fund --new-quantum 100   # same, for a quantum account (prints seed hex)
pnpm ios                               # or: pnpm android
pnpm localnet:stop
```

Point the app at it from Settings, Developer, Node Settings, Custom network. Selecting it opens a
sheet for the algod and indexer URLs, their optional tokens, and the genesis hash and ID; **Fetch
from node** fills the genesis values in. **Save and switch** applies the config at runtime, with no
rebuild, no env rewrite, and MainNet and TestNet untouched.

Two things to watch:

- On a physical device, `localhost` resolves to the device, not your machine. Use the host's LAN
  address (`http://192.168.1.50:4001`).
- `pnpm localnet:reset` regenerates the genesis hash, so re-enter the custom config afterwards.

### Quantum (post-quantum) verification

```sh
pnpm localnet:quantum-check
```

Runs an end-to-end check of a quantum-signed transaction against LocalNet: derives a Falcon-1024
address, funds it, builds a payment with a PQ-raised fee, checks the assembled PQ envelope against
algosdk's own PQ signer, then broadcasts and waits for confirmation.

Default LocalNet (`algod` 4.7.4-stable) has no `pqsig` support, so the script
reports PENDING at exit 0 once the broadcast is rejected for that reason
specifically. Any other failure reports FAIL with a non-zero exit.

For a real **PASS: confirmed in round N**, point LocalNet at a `pqsig`-capable node. Two things are
needed together: the `master` image, and a genesis whose consensus enables Falcon-1024 (v42,
inherited by `future`). Edit `~/.config/algokit/sandbox/`:

```sh
# docker-compose.yml          -> image: algorand/algod:master
# algod_network_template.json -> add  "ConsensusProtocol": "future",  under "Genesis"
docker compose -f ~/.config/algokit/sandbox/docker-compose.yml down -v
docker compose -f ~/.config/algokit/sandbox/docker-compose.yml up -d
pnpm localnet:quantum-check   # -> PASS: confirmed in round N
```

The check talks to `localhost:4001` directly and needs no app config. To exercise the app against
this node, re-enter the custom network in Settings, Developer, Node Settings. Recreating the
containers changes the genesis hash, so the previously saved config no longer matches.

`algokit localnet start` and `reset` both rewrite those two files, so re-apply the edits after
running either. `algorand/algod:nightly` is not a substitute; it still lacks `pqsig`.

> [!WARNING]
> This swap kills the indexer, but the app still works. Consensus v42 also enables `LoadTracking`,
> adding a `ld` field to the block header. The published `conduit-localnet` and `indexer` images
> predate it and cannot decode it, so conduit dies with
> `error decoding block for round 1: msgpack decode error ... key ld` and the
> indexer stays pinned at round 0 (`docker logs algokit_sandbox_conduit`;
> `curl -s localhost:8980/health`).
>
> Balances, the asset list and sending are unaffected, because `account-syncer.ts` reads them from
> algod and holdings only fall back to the indexer past algod's resource cap. Expect indexer-backed
> surfaces (transaction history, large accounts) to be empty. If a balance reads 0.00 on LocalNet it
> is far more likely a stale `account_balances` row than the indexer: pull-to-refresh does NOT
> re-fetch when a row already exists, so relaunch the app after funding.

### Conformance suite

`pnpm test:conformance` runs the app's builders, keystore, signing and error-handling code against
this LocalNet instead of a mock. [`conformance/README.md`](conformance/README.md) covers what it
proves, its prerequisites and its known gaps.

## Workspace layout

```
pera-react-native/
├── apps/
│   ├── mobile/              # React Native app (UI layer)
│   └── browser/             # Chrome MV3 browser extension
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
├── conformance/             # LocalNet conformance suite
├── tools/                   # Development and CI scripts
├── specs/                   # OpenAPI specifications
└── docs/                    # Project documentation
```

`extensions/` means platform drivers, not browser extensions. See
[Architecture](docs/ARCHITECTURE.md) for why the two names collide.

The workspace definition is in [`pnpm-workspace.yaml`](pnpm-workspace.yaml).

## Tooling

- Task runner and cache: Turborepo (scripts in [`package.json`](package.json))
- Formatting: oxfmt
- Linting: Oxlint via [`.oxlintrc.json`](.oxlintrc.json)
- Dead code, cycles, duplication: fallow via [`.fallowrc.jsonc`](.fallowrc.jsonc)
- TypeScript project references via [`packages/devtools/tsconfig`](packages/devtools/tsconfig)

## Common commands

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
pnpm lint:docs      # report stale doc/comment references
pnpm format         # format files
pnpm fallow         # report unused code, circular deps, duplication
```

## Dead code, cycles and duplication

[fallow](https://github.com/fallow-rs/fallow) finds cross-module unused exports, files, types and
dependencies, plus circular dependencies and code duplication, which neither Oxlint nor `tsc` cover.
Config lives in [`.fallowrc.jsonc`](.fallowrc.jsonc).

It runs in CI as an advisory, non-blocking job (`Dead Code` in
[`pre-merge.yml`](.github/workflows/pre-merge.yml)): findings appear in the job summary but never
fail a PR. The plan is to triage the existing findings, then ratchet specific rules to blocking with
a `--baseline` so only new findings fail. Do removals in reviewed PRs, not via `fallow fix`.

## Documentation

| Doc                                                        | Covers                                                       |
| ---------------------------------------------------------- | ------------------------------------------------------------ |
| [Architecture](docs/ARCHITECTURE.md)                       | Layering, platform drivers, per-platform features            |
| [Style Guide](docs/STYLE_GUIDE.md)                         | Decisions behind the enforced rules                          |
| [Testing](docs/TESTING.md)                                 | Unit, integration harness, locale tour                       |
| [Security](docs/SECURITY.md)                               | Reporting a flaw, key custody, vault limits, supply chain    |
| [Offline & Paused State](docs/OFFLINE_PAUSED_STATE.md)     | DB-first reads, the paused render contract                   |
| [Translation Guide](docs/I18N_TRANSLATION_GUIDE.md)        | Locale bundles, plural traps, per-language rules             |
| [WebView Architecture](docs/WEBVIEW_ARCHITECTURE.md)       | The in-app webview bridge, its trust model and v3 method set |
| [Pera Card](docs/PERA_CARD.md)                             | Baanx contract, onboarding, AutoDraw                         |
| [CI Automation](docs/CI_AUTOMATION.md)                     | Jira sync and release publishing                             |
| [Release](docs/RELEASE.md)                                 | Tags, pipelines, store submission                            |
| [Documentation Standards](docs/DOCUMENTATION_STANDARDS.md) | Where a given piece of documentation belongs                 |
| [Contributing](CONTRIBUTING.md)                            | Branches, commits, PRs                                       |

For app-specific notes, see [`apps/mobile/README.md`](apps/mobile/README.md).
