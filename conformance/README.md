# Conformance suite

Vitest suites that run the app's own builders/keystore/signing/error-handling
code against a **real** Algorand node (LocalNet) rather than a mock. See
`docs/superpowers/specs/2026-08-24-localnet-conformance-suite-design.md` for
the design.

## Running

```sh
pnpm localnet          # start LocalNet if it isn't already running
pnpm test:conformance   # from the repo root, or `pnpm exec vitest run` from here
```

`src/harness/localnet.ts` fails fast with a clear message if LocalNet isn't
reachable at `http://localhost:4001`.

## `dist/` dependency (CI-relevant)

Every workspace package this suite imports is resolved via `vitest.config.ts`'s
`resolve.alias`, straight to that package's `src/` — **except** one path in
`src/suites/submission/chokepoint.spec.ts`, which imports
`submitAndAutoRefreshCore` from `@perawallet/wallet-core-signing`. That file
also imports the full `@perawallet/wallet-core-blockchain` barrel (for real
`toAlgodError` classification logic the suite exercises, not through a `src`
alias), which is **not** aliased and therefore resolves through each
package's own `package.json` `main`/`exports` field — i.e. its built `dist/`.
Transitively, that barrel requires a built `dist/` for:

- `@perawallet/wallet-core-remote-config`
- `@perawallet/wallet-extension-platform`
- `@perawallet/wallet-core-hardware-wallet`
- `@perawallet/wallet-core-database`

If any of these has no `dist/` (e.g. a fresh clone/worktree that hasn't run a
build), the import fails at Vitest's collection step — **an unresolvable-import
crash that takes every file in the run down**, not an isolated test failure.
Build the affected packages before running this suite in an environment that
hasn't already built them:

```sh
pnpm --filter @perawallet/wallet-core-remote-config build
pnpm --filter @perawallet/wallet-extension-platform build
pnpm --filter @perawallet/wallet-core-hardware-wallet build
pnpm --filter @perawallet/wallet-core-database build
```

`@perawallet/wallet-extension-provider`'s real implementation additionally
pulls in `react-native-mmkv` (a native module that cannot load under Node);
`vitest.setup.ts` mocks it with an in-memory `keyValueStorage` stand-in
instead of building it — only platform storage is mocked, never algod.
`@perawallet/wallet-core-accounts`'s full barrel (multisig/staking/currencies
hooks, unrelated to the submission chokepoint) is similarly stubbed, file-
scoped, in `chokepoint.spec.ts` itself.
