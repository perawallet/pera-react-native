# Task: fall back to public Algorand services when the Pera backend is unavailable

## Objective

The app routes many reads through the **Pera backend** (`backend: 'pera'`). For a
subset of those, Pera is only a _middleman_ — the same information is obtainable
directly from **algod**, the **indexer**, or another public service that Pera
itself consumes.

On any network with no Pera deployment (**betanet**, and every **custom** node —
LocalNet, an fnet instance, a private node) those requests cannot succeed, so
every feature behind them is dead even when the underlying chain data is sitting
right there on a reachable indexer.

Your job, in order:

1. **Enumerate** every `backend: 'pera'` call site.
2. **Classify** each as _chain-derivable_ (obtainable from a public source) or
   _Pera-proprietary_ (only Pera has it).
3. **Implement a direct-public fallback** for the chain-derivable ones, used when
   the Pera backend is unavailable.
4. **Verify** with tests, and by exercising the app against a non-Pera network.

Correct classification matters more than volume. A wrong "fallback" that invents
or degrades data is worse than no fallback.

## Verified starting facts (do not re-derive; do sanity-check)

- **72 call sites** across ~30 files:
  `grep -rn "backend: 'pera'" packages apps --include="*.ts" --include="*.tsx" | grep -v __tests__`
- The failure is **structural and deterministic**, not a flaky network:
  [`query-client.ts`](../../packages/shared/src/api/query-client.ts) builds a set
  of networks whose Pera `backendUrl` is empty and throws
  **before a socket opens**:
    ```ts
    if (
        requestConfig.backend === 'pera' &&
        networksWithoutPeraBackend.has(requestConfig.network)
    ) {
        throw new PeraServiceUnavailableError(requestConfig.network)
    }
    ```
- Worked example of the damage — HD account discovery:
  [`account-discovery.ts`](../../packages/accounts/src/account-discovery.ts)'s
  `checkActivityBatch` probes existence via
  [`fetchAccountFastLookup`](../../packages/shared/src/api/account-fast-lookup.ts)
  (`backend: 'pera'`). It swallows failures as `accountExists: false` — **twice**,
  once per address and once for the batch. On a custom node every address reports
  as non-existent, discovery finds nothing, and `discoverAccounts` falls back to
  returning only the master account. Users cannot import a funded HD address at
  all. **The indexer can answer this exact question and is reachable on those
  networks.** This is the canonical case to fix.

## Reuse what already exists — do not rebuild it

- **`isPeraBackedNetwork(network)`** and `PERA_BACKED_NETWORKS` —
  [`network-config.ts:128`](../../packages/config/src/network-config.ts#L128).
- **`PeraServiceUnavailableError`** and the `isPeraServiceUnavailableError` type
  guard — [`errors/pera-service.ts`](../../packages/shared/src/errors/pera-service.ts).
- **Prior art to imitate.** Several call sites already branch correctly; read
  these first and follow their shape rather than inventing a new pattern:
    - [`sync-service.ts:~265`](../../packages/background/src/service/sync-service.ts) —
      checks `isPeraBackedNetwork` _before_ issuing the request, so a tick never
      pays for a throw that cannot succeed, and keeps chain sync alive on algod +
      indexer alone. Note its reasoning about not engaging backoff.
    - `packages/transactions/src/hooks/useTransactionHistoryQuery.ts`,
      `packages/assets/src/hooks/useSingleAssetDetailsQuery.ts`,
      `packages/assets/src/sync/asset-syncer.ts`.
- **`fetchAccountExists`** (single-address sibling of the batch lookup)
  deliberately **throws** instead of swallowing, and its docstring explains why:
  swallowing is _"wrong for callers that must degrade to a capped scan"_. That
  distinction is the seed of the right design.

## Classification rubric

Decide per endpoint. Be strict, and record your reasoning.

**Chain-derivable → implement a fallback.** The Pera response is a view over
public chain state, e.g.:

- does an account exist / account information → algod `GET /v2/accounts/{addr}`
- transaction history for an address → indexer `GET /v2/accounts/{addr}/transactions`
- asset holdings, opt-ins, rekey/auth-addr → algod or indexer
- accounts rekeyed to an address → indexer (already done this way in
  `discoverRekeyedAccounts`; use it as the model)

**Pera-proprietary → do NOT fake it.** Leave it failing (or already-guarded), e.g.:

- fiat prices / currency conversion, portfolio value in fiat
- Pera's asset metadata, verification tiers, curated asset lists
- swap quotes and routing, onramp quotes/orders/regions, card, staking
- banners, spot banners, notifications, inbox (ARC-59 surfaces may be partially
  chain-derivable — judge carefully, and only claim it if you can prove it)
- device registration, app integrity, telemetry

**Third-party public services Pera proxies.** Some data has a public upstream that
is _not_ algod/indexer — check `packages/nfd` (NFD has its own public API at
nf.domains). If Pera is merely proxying such a service, calling it directly is a
legitimate fallback. Confirm the upstream is genuinely public and does not need a
Pera-held credential before relying on it.

**When unsure, do not guess.** Record the endpoint in an "undecided" list with
what evidence you would need. An honest undecided list is a good outcome.

## Design constraints

- **Trigger on the typed error, not on any failure.** Fall back when the cause is
  `PeraServiceUnavailableError` (structurally absent), or check
  `isPeraBackedNetwork` up front as `sync-service` does. A 500, a 401 from a bad
  `BACKEND_API_KEY`, or a timeout is **not** the same thing and must not silently
  reroute — that would mask real outages and make Pera-vs-public results
  indistinguishable in production.
- **Never widen a swallow.** The existing double-catch in `checkActivityBatch` is
  the bug pattern to remove, not to copy: it makes "service absent" and "address
  not on chain" identical. Prefer surfacing, or falling back, over returning a
  confident wrong answer.
- **Semantics must match, or be explicitly narrower.** Indexer pagination, `round`
  vs Pera's cursors, `next-token`, and field shapes differ. If the fallback cannot
  reproduce a field, the type must make that absence explicit — do not default to
  `0`, `''`, or `false` where the real value is unknown. Financial values are
  `Decimal` (see `CLAUDE.md`); `bigint` only at the blockchain boundary.
- **Indexer availability is not guaranteed either.** A custom node may have algod
  but no indexer. Handle that (prefer algod where it suffices; degrade honestly).
- **Do not touch:** TLS pinning config, `peraRetryConfig` (never add `'post'`),
  or the ATS/`NSAllowsLocalNetworking` setup.
- **Caching.** These reads sit behind TanStack Query. Keep query keys distinct per
  data source, or ensure a source switch invalidates — a cached Pera-shaped
  payload must not be read as a fallback-shaped one.

## Deliverables

1. **An inventory table** (commit as `docs/audits/pera-backend-dependency-audit.md`):
   every `backend: 'pera'` call site → endpoint path → what it returns →
   classification → public source (if any) → whether a fallback was implemented.
   Include the undecided list.
2. **Implemented fallbacks** for the chain-derivable set, following the existing
   per-package `api/*/endpoints.ts` + hook conventions in `CLAUDE.md`.
   `packages/accounts` HD discovery (`checkActivityBatch`) is the highest-value
   fix — start there and let it shape the shared pattern.
3. **Tests.** Unit tests per changed hook/util (this is where behaviour lives, per
   `CLAUDE.md`). Cover: Pera path, fallback path, and that a non-availability
   error (500/401/timeout) does **not** trigger the fallback. MSW handler
   factories live in `packages/*/src/**/msw-handlers.ts`.
4. **A short summary** of what is now possible on betanet/custom that was not, and
   what remains genuinely impossible (so the limitation is documented, not
   rediscovered).

## Verification

```sh
pnpm pre-push --no-fail-on-error
pnpm exec turbo run test:unit --force   # --force: turbo caches test:unit and a
                                        # cached replay looks identical to a real run
pnpm build                              # includes mobile tsc --noEmit
```

Then exercise it against a real non-Pera network — this is the only way to prove
the point. Official **fnet** works and needs no credentials:

- algod `https://fnet-api.4160.nodely.dev`, indexer `https://fnet-idx.4160.nodely.dev`
- In-app: **Settings → Developer Settings → Node Settings → Custom network**,
  enter the algod URL, press **Fetch from node** to fill genesis hash + ID, then
  **Save and switch**.
- Acceptance for the flagship case: importing a 24-word HD mnemonic whose funded
  address is **not** at keyIndex 0 must discover and offer that address.

## Pitfalls observed while diagnosing this

- Comments in this area have been wrong: `checkActivityBatch` described its probe
  as _the indexer_ when it is the Pera backend. **Verify the data source in code;
  do not trust the comment.**
- An empty result and a dead service look identical in the UI. During onboarding a
  zero-result discovery is reported to the user as "no addresses found", which is
  a lie when the probe never ran.
- The app can silently sit on **betanet** (a network added recently), so a
  `TESTNET_*`-style config override appears to be ignored. Confirm the live
  network before blaming endpoints — fastest via the DB, not the UI:
    ```sh
    sqlite3 "$(xcrun simctl get_app_container <udid> com.algorandllc.perarn.staging data)/Documents/SQLite/pera.db" \
      "SELECT account_address, network, algo_balance FROM account_balances;"
    ```
- Watch accounts count as imported: `useAllAccounts()` is unfiltered, so a watched
  address is filtered out of the import list. Unrelated to this task, but it will
  confuse manual testing of discovery if you are watching the address you import.

## Non-goals

- Do not make Pera-proprietary features work offline or on non-Pera networks.
- Do not change which network the app defaults to, or the custom-network UI.
- Do not add new third-party dependencies or a new HTTP client; use the existing
  algod/indexer clients from `packages/blockchain`.
