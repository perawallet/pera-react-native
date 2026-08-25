# Conformance suite

Vitest suites that run the app's own builders, signing pipeline, transformers
and error handling against a **real** Algorand node (LocalNet) rather than a
mock. `docs/LOCALNET_CONFORMANCE.md` lists exactly which app functions are
under test; see
`docs/superpowers/specs/2026-08-24-localnet-conformance-suite-design.md` for
the design.

Only key custody is substituted: `harness/keystore.ts` swaps the React Native
Keychain driver for an in-memory one, and everything above it —
`signTransactionsWithLocalKey`, `resolvePQSigningInfo`,
`createLocalKeyStrategy`, `assignMinimumFeesToGroup` — is the app's own code.
`harness/__tests__/` holds the two files that test the harness itself rather
than the app, and each says so in its header.

## Running

```sh
pnpm localnet          # start LocalNet if it isn't already running
pnpm test:conformance   # from the repo root, or `pnpm exec vitest run` from here
```

`src/harness/localnet.ts` fails fast with a clear message if LocalNet isn't
reachable at `http://localhost:4001`.

## `dist/` dependency (CI-relevant)

Every workspace package this suite imports IS aliased in `vitest.config.ts`'s
`resolve.alias` — `@perawallet/wallet-core-blockchain` maps to
`packages/blockchain/src`, and Vite's prefix replacement means both the bare
specifier and any deep import (`@perawallet/wallet-core-blockchain/errors`,
etc.) hit `src`, never `dist`. That is not where the problem is.

`src/suites/submission/chokepoint.spec.ts` imports `submitAndAutoRefreshCore`
from `@perawallet/wallet-core-signing`, and that file also imports the full
`@perawallet/wallet-core-blockchain` barrel (for real `toAlgodError`
classification logic the suite exercises). The barrel itself resolves fine —
but **its own source has non-aliased dependencies one level out**:
`fees/useMinimumFeeConfig.ts` imports `@perawallet/wallet-core-remote-config`,
and `utils/clearCustomNetworkCache.ts` imports `@perawallet/wallet-core-database`.
Neither of those is in `vitest.config.ts`'s alias list, so each resolves
through its own `package.json` `main`/`exports` field — i.e. its built
`dist/` — and remote-config transitively pulls in `wallet-extension-platform`
→ `wallet-core-hardware-wallet` the same way. In short: a built `dist/` is
required for:

- `@perawallet/wallet-core-remote-config`
- `@perawallet/wallet-extension-platform`
- `@perawallet/wallet-core-hardware-wallet`
- `@perawallet/wallet-core-database`

If any of these has no `dist/` (e.g. a fresh clone/worktree that hasn't run a
build), the import fails at Vitest's collection step — **an unresolvable-import
crash that takes every file in the run down**, not an isolated test failure.

These four are not independent — `wallet-extension-platform` depends on
`wallet-core-hardware-wallet`'s dist, and both `wallet-core-database` and
`wallet-core-remote-config` depend on `wallet-extension-platform`'s (building
`wallet-core-database` first fails with `Cannot find module
'@perawallet/wallet-extension-platform'`). They also aren't the full picture:
`wallet-core-remote-config` alone pulls in `wallet-core-shared`,
`wallet-extension-provider`, and (transitively through provider)
`wallet-extension-platform-driver` and the ledger extension packages, and
`conformance/tsconfig.json`'s `paths` reach further still (e.g.
`wallet-core-multisig`, `wallet-core-assets`, both pulled in via
`wallet-core-accounts`). Don't hand-enumerate the closure — build everything
and let turbo's `dependsOn: ["^build"]` resolve the graph in order, the same
way `pnpm run build` already does for the rest of the repo:

```sh
pnpm run build
```

`@perawallet/wallet-extension-provider`'s real implementation additionally
pulls in `react-native-mmkv` (a native module that cannot load under Node);
`vitest.setup.ts` mocks it with an in-memory `keyValueStorage` stand-in
instead of building it — only platform storage is mocked, never algod.
`@perawallet/wallet-core-accounts`'s full barrel (multisig/staking/currencies
hooks, unrelated to the submission chokepoint) is similarly stubbed, file-
scoped, in `chokepoint.spec.ts` itself.
