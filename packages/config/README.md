# Configuration

Zod-validated, type-safe configuration with safe open-source defaults and build-time injection from
environment variables.

## How a value is resolved

`getConfig()` in `src/main.ts` merges two things and validates the result against `configSchema`:

1. `productionConfig`, the committed defaults in `src/main.ts`. These are safe for open-source builds:
   public AlgoNode infrastructure, staging backend URLs, empty API keys.
2. `generatedEnv` from `src/generated-env.ts`, written by `tools/generate-config.sh` from the
   environment at build time. That file is gitignored, so a checkout always starts from the
   committed defaults.

`overrideEnvironmentMap` (bottom of `src/main.ts`) is the authoritative mapping from config field to
environment variable name. Read it rather than any list in this file.

`tools/generate-config.sh` sources `.env` at the repo root, then an optional overlay file named by
`PERA_ENV_OVERLAY` which wins over `.env`.

Environment variable names are **not** prefixed. It is `BACKEND_API_KEY`, not `PERA_BACKEND_API_KEY`.
The only `PERA_`-prefixed variables are `PERA_ENV_OVERLAY` and `PERA_DEFAULT_NETWORK`, the latter a
fallback for `DEFAULT_NETWORK`.

## Build channel

`APP_ENV` selects the channel: `development` (the default when unset), `staging` or `production`. It
picks the Discover base URL, and in a production build the schema **rejects** any first-party URL
that still points at staging, naming the variable you need to set. That is a build-time failure by
design, rather than an app that launches against the wrong backend.

## Adding a config value

A new value needs four edits, and missing any one of them leaves it silently unreachable rather than
broken:

1. A field on `configSchema` and a default on `productionConfig` (`src/main.ts`).
2. An entry in `overrideEnvironmentMap` mapping that field to its variable name.
3. An `append_config` line in `tools/generate-config.sh`, or the variable never reaches
   `generated-env.ts`.
4. The variable name in `turbo.json`'s `globalEnv`, or turbo will not hash it.

Step 4 is the one that bites. `generated-env.ts` is gitignored, so `$TURBO_DEFAULT$` never hashed it,
and a dist built from staging secrets shared a task hash with one built from production secrets.
`turbo run build` would then restore a stale `dist/**` over a freshly rebuilt copy, and the esbuild
surfaces (service worker, content scripts, db worker) shipped committed defaults while the Metro
bundle, which resolves `packages/*/src` directly, shipped the real values.

## Example build

```sh
APP_ENV=staging \
MAINNET_BACKEND_URL=https://mainnet.staging.api.perawallet.app \
TESTNET_BACKEND_URL=https://testnet.staging.api.perawallet.app \
BACKEND_API_KEY=... \
DEBUG_ENABLED=true \
pnpm build
```

## What the schema covers

Algod and indexer URLs per network, Pera backend URLs, API keys, genesis hashes, explorer and
dispenser URLs, support and external service links, card service configuration, timing and React
Query cache settings, and the debug, profiling and polling flags.

Betanet carries chain endpoints only. It has no Pera backend, so its Pera service traffic fails typed
through `createPeraClient`; see [Architecture](../../docs/ARCHITECTURE.md).
