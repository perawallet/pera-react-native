# Multi-chain migration

How the codebase moves from Algorand-only to the architecture in `docs/MULTI_CHAIN.md` without
breaking the wallet's most-used flows on the way. The target is described there; this records the
constraints on the route.

## Rules every step obeys

1. **The build is green and the app works when the step lands.** No step depends on a follow-up to
   restore function.
2. **Expand, migrate, contract.** Anything replacing an existing shape is three steps: add the new
   alongside the old, move consumers, delete the old. Never one.
3. **Additive before destructive.** New columns and fields land, are backfilled and are dual-written
   before any read switches to them, and long before anything is dropped.
4. **User-visible behaviour ships behind a flag.** A config flag needs four wirings: the flag, the
   `tools/generate-config.sh` entry, the turbo `globalEnv` entry, and the `vitest.setup.ts` platform
   mock. Missing one leaves it silently unreachable in the browser build.
5. **Tests ship with the step.** Hooks, utils, stores and transformers are unit-tested; screens are
   covered by the integration harness.

## Extraction direction

The `algorand → blockchain` dependency direction is not only a design preference. The Algorand code inside `blockchain` today imports
`blockchain`'s own `models`, `store`, `errors` and `schema`, so moving it out first and having
`blockchain` re-export it would make the two packages depend on each other. Turbo builds each
workspace after its dependencies and refuses a cycle. The extraction therefore runs in the other
direction: `@perawallet/wallet-core-algorand` starts as a facade re-exporting the Algorand surface of `blockchain`,
consumers repoint to the facade, and only then does the code move behind it. A test that fails if
`packages/blockchain/package.json` ever lists `@perawallet/wallet-core-algorand` keeps the direction
true afterwards.

The exception described in `docs/MULTI_CHAIN.md` under "Package topology" is the one file that keeps a
type-only algosdk dependency inside `blockchain` for the duration; the ESLint rule allowlists it alone,
and `blockchain` drops algosdk and algokit-utils from its runtime dependencies once everything else has
moved.

## Database

The chain scope goes into the existing `network` column as a `ChainScopeKey`. The alternative, a new `chain_id` column followed by rebuilding every primary key, is create, copy,
drop and rename of ten tables on live user data, because SQLite cannot alter a primary key. Storing
the scope in the value that is already in the key removes the riskiest step in the whole migration.
The backfill is one idempotent `UPDATE` per table, guarded by `WHERE network NOT LIKE '%:%'` so an
interrupted run can be repeated.

Repositories accept a bare `Network` during the migration and interpret it as the Algorand scope at
the database boundary, so no caller changes when the column is widened. Callers then move to
`ChainScope` one package at a time, and the bare-`Network` overload is removed last, with a lint rule
flagging any bare `Network` that reaches a repository or a query-key builder afterwards.

## The first slice is thin on purpose

Before the Algorand adapter, the database and the account model are migrated in full, a vertical slice
behind the flag shows one ETH balance on one account: the chain identity and registry, credentials
and enabled chains, secp256k1 derivation through the keystore, the EVM descriptors and account-state
read, and a sync fan-out that handles native ETH only. Port shapes are cheap to pressure-test with a
throwaway EVM data source before anything commits to them; the slice de-risks everything downstream
of the ports, which is the actual risk of the programme.

## Constraints from outside

- WalletConnect `eip155` namespaces presuppose v2 sessions. The v1 fork the wallet wraps today has
  no namespace concept to extend, so EVM over WalletConnect follows the v2 migration.
- secp256k1 in the keystore is upstream work in the keystore repositories, in all three backends with
  the same known-answer vectors in each. Nothing on EVM can sign without it.
- EVM needs an RPC provider and an indexer vendor, both with accounts and keys that do not exist for
  Algorand. Choosing them is a recorded decision; see Ports in `docs/MULTI_CHAIN.md`.

## Out of scope for the first EVM release

Each of these is a project of its own, and none is a refactor of anything existing:

- The injected EIP-1193 `window.ethereum` provider for the browser extension: injection, request
  routing, chain switching, and `accountsChanged` / `chainChanged` events.
- Ledger's Ethereum app. Hardware accounts are Algorand-only until it is supported.
- Migrating Algorand's existing verticals onto the ports. The Algorand adapter wraps existing code
  while Algorand's direct paths remain; doing it early buys nothing and risks the most-used flows.
- Retiring `PeraDisplayableTransaction`. `TransactionSummary` is added alongside it, which is all an
  EVM row or signing review needs.
- Arbitrary contract ABI resolution and transaction simulation. The unrecognised-interaction screen
  makes both optional by refusing to characterise what it cannot decode.

## See also

- `docs/MULTI_CHAIN.md`: the target architecture and the rules that keep it
