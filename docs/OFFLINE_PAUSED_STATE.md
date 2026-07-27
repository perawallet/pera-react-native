# Offline-first reads & the paused-state UI contract

Pera's offline story is built on one rule: **SQLite is the source of truth.**
Account, asset, transaction, and price data is read from the local database
(`pera.db`) and only refreshed from the network in the background. Because of
that, those queries are deliberately excluded from AsyncStorage persistence in
`apps/mobile/src/providers/QueryProvider.tsx` — the DB _is_ the cache.

This document codifies two things every data-backed surface must follow:

1. **How DB-first queries are configured** so they actually serve SQLite while
   offline.
2. **The render-state contract** consumers use to tell "offline" apart from
   "loading" and "error".

---

## 1. DB-first queries must use `networkMode: 'always'`

TanStack Query defaults to `networkMode: 'online'`. Under that default, while
`onlineManager` reports offline a query is **paused _before its `queryFn`
runs_**. For a query whose `queryFn` reads SQLite, that means the DB read never
executes: on a cold offline launch there is no memory cache and no persisted
snapshot, so the query sits in `pending`/`paused` forever — the "loads forever"
skeleton QA reported.

The fix is per-query, not global:

```ts
useQuery({
    queryKey: ...,
    queryFn: () => readSomethingFromDb(...),
    staleTime: Infinity,
    // SQLite is the source of truth; run the queryFn even while offline
    // instead of pausing it, which would strand consumers in `pending`.
    networkMode: 'always',
})
```

> **Do NOT flip the global default in `QueryProvider`.** Pure-network queries
> (e.g. balance history, price history, asset search) must keep pausing until
> their own surface tickets give them explicit offline UX. Flipping the global
> default would make them throw offline instead.
>
> **PERA-4581 adopts this for charts.** `useAccountBalancesHistoryQuery`,
> `useAccountsAssetsBalanceHistoryQuery`, and `useAssetPriceHistoryQuery` stay
> pure-network — `networkMode` is untouched, so they still pause offline.
> `BalanceLineChart` (shared by `WealthChart`, `AssetPriceChart`, and
> `AssetWealthChart`) now renders the pause via a colocated
> `useBalanceLineChart` hook: data → offline → error → loading → empty, with a
> retry that reads `hasInternet` at press time and, while offline, opens the
> standard informational bottom sheet (`ConfirmActionContent`) explaining the
> situation instead of dispatching a doomed request or silently doing nothing.
> `PriceTrend` follows
> the same contract via `usePriceTrend`, hiding itself when paused with no
> cached data. Note the chart surface deliberately deviates from §2's
> `isError → isPaused` precedence: it collapses an errored query on a
> known-offline device into the offline surface, since a retry can't act on
> the error until connectivity returns.

### Guarding the network segment

Some DB-first `queryFn`s also touch the network (self-heal fetches, load-more
pages). With `networkMode: 'always'` those segments now run while offline too,
so they must not reject the whole `queryFn`:

- If the network path is already wrapped so its errors are caught/swallowed (the
  account syncer) or it uses `Promise.allSettled` (asset detail API fallback),
  nothing more is needed — the DB read still resolves.
- Otherwise, guard explicitly. `useTransactionHistoryQuery` reads the first page
  from the DB and only hits the network for load-more pages; it checks
  `onlineManager.isOnline()` before the network branch and returns a **terminal
  page** when offline, so the DB-backed first page stays rendered and the query
  never flips to `isError`.

> `onlineManager.isOnline` is a **method** — call `onlineManager.isOnline()`, not
> `onlineManager.isOnline`.

### Persisting network-only chart snapshots (the exception to the exclusion rule)

The intro rule excludes DB-backed queries from persistence because SQLite is
already the cache. Chart-history queries are the opposite case: they are
network-only (no SQLite table backs them) and carry no PII, so the last
successful snapshot is exactly what lets a chart show last-known data on a
cold, offline launch. `apps/mobile/src/providers/query-persistence.ts`
allowlists two query-key predicates into `shouldDehydrateQuery`, dehydrated
only when the query last resolved with `status === 'success'`:

- `isAccountBalancesHistoryQuery` — `['accounts', 'balance-history', …]`
- `isAssetPriceHistoryQuery` — `['assets', 'prices', 'history', …]`

The per-account asset-history key (`['accounts', 'assets', 'balance-history',
…]`, used by `AssetWealthChart`) is deliberately **not** allowlisted —
PERA-4581 scoped persistence to exactly those two keys.

### `CHART_QUERY_TIMEOUT_MS` stays at 30 s

`CHART_QUERY_TIMEOUT_MS` (`packages/shared/src/models/constants.ts`) was
reconsidered as part of PERA-4581 and kept at 30 000 ms. No production
latency measurements were available to justify lowering it; the constant's
own doc comment records that these aggregation endpoints routinely exceed
ky's 10 s default; and the offline retry short-circuit above removes the
doomed-30 s-wait UX that motivated reconsidering the value in the first
place — a retry pressed while offline never dispatches the request. Revisit
with real latency metrics if they become available.

---

## 2. The paused-state render contract

Offline is not an error, and it is not "loading". A paused query has a distinct
render state. Use `getQueryRenderState` from `@perawallet/wallet-core-shared` to
normalise any `useQuery`/`useInfiniteQuery` result into the shared contract:

```ts
import { getQueryRenderState } from '@perawallet/wallet-core-shared'

const { data, isPending, isPaused, isFetching, isError, error } =
    getQueryRenderState(query)
```

| Flag         | Meaning                                                            | Render                                                              |
| ------------ | ------------------------------------------------------------------ | ------------------------------------------------------------------- |
| `isError`    | `status === 'error'`                                               | Error state **with a retry affordance**                             |
| `isPaused`   | `fetchStatus === 'paused'` (offline)                               | Offline / cached surface — **not** a spinner                        |
| `isFetching` | `fetchStatus === 'fetching'`                                       | Spinner, or a background-refresh indicator if `data` already exists |
| `isPending`  | cold idle load: `status === 'pending'` && `fetchStatus === 'idle'` | Initial skeleton                                                    |

**Precedence** (highest first): `isError` → `isPaused` → `isFetching` →
`isPending`.

`isPending` is intentionally narrower than TanStack's own `isPending`: a query
that is `pending` because it is `paused` (offline, no cache) raises `isPaused`,
**not** `isPending`, so consumers render the offline surface instead of an
eternal skeleton.

### Rendering the offline surface: `OfflineTolerantView`

Screens do **not** hand-roll the offline fork. `apps/mobile/src/components/OfflineTolerantView`
renders the shared offline surface — and, optionally, the shared error surface
— in place of its children:

```tsx
<OfflineTolerantView
    isOffline={isOffline}
    isError={isError}
    onRetry={handleRetry}
>
    {/* whatever the surface renders when it has something to show */}
</OfflineTolerantView>
```

It owns the middle of the precedence (`offline → error`); callers keep owning
`data`, `loading` and `empty`, which stay surface-specific. Notes:

- **`isOffline` is computed by the caller's hook**, not by the component. The
  honest signal is per-query (`isPaused || (isError && !hasInternet)`), not
  per-device — a screen with cached data is not "offline" just because the
  radio is off.
- **Omit `isError`** on surfaces that render their own branded error UI
  (`StakingScreen` does); they delegate the offline arm only.
- **Omit `onRetry`** where retrying isn't meaningful and no button is rendered
  (`AddAssetView`'s search re-runs on the next keystroke).
- `retryLabel` and `errorBody` override the default `common.retry.label` /
  `common.error.body` copy.

`BalanceLineChart` predates the component and keeps its own five-arm
`renderState` switch (it also drives a `loading`/`empty` fork and an
offline-aware retry sheet); it renders the identical copy and icons.

## Offline writes: fail fast, roll back, say why

`OfflineTolerantView` covers offline _reads_. Offline _writes_ are a different
problem: the request has already been attempted, and something local may have
been changed optimistically.

Every remotely-synced write must satisfy four properties:

1. The optimistic local write is applied immediately, so the control responds.
2. The network call is attempted immediately — never queued, never paused.
   `mutationDefaults` (`networkMode: 'always'`) guarantees this.
3. On rejection the local write is reverted, and `showError` from
   `@hooks/useErrorToast` surfaces cause-appropriate copy — connectivity
   failures get `errors.network.no_connection.*`, everything else the
   PERA-4574 mapping.
4. Once the interaction settles, persisted local state equals what the backend
   was last told.

Property 4 is the one that bites. Persisted Zustand stores survive a restart,
so an optimistic value the backend never received becomes permanent
divergence. Never leave one behind.

`apps/mobile/src/hooks/useAccountNotificationToggle.ts` is the reference
implementation. Note that it is a _single_ hook shared by both call sites —
the bug it replaced was a duplicated toggle where one copy had silently
dropped the network call.

There is deliberately no offline outbox or replay queue (PERA-4573 policy).

### Why DB-first hooks still expose `isPaused`

A DB-first query with `networkMode: 'always'` never actually pauses, so its
`isPaused` is always `false`. It is still exposed on those hooks' result types
(`useAccountSummaryQuery`, `useAccountAssetsQuery`, `useAccountBalancesQuery`,
`useAssetPricesQuery`, `useTransactionHistoryQuery`, …) so that screens can
consume one uniform, paused-aware shape regardless of whether the underlying
query is DB-first or pure-network. Surface tickets (PERA-4578..4581, PERA-4584,
PERA-4585) adopt this contract.
