# Offline-first reads and the paused-state UI contract

Pera's offline story rests on one rule: SQLite is the source of truth.
Account, asset, transaction, and price data is read from the local database
(`pera.db`) and only refreshed from the network in the background. Because of
that, those queries are deliberately excluded from AsyncStorage persistence in
`apps/mobile/src/providers/QueryProvider.tsx`, because the DB _is_ the cache.

Two things follow from that, and every data-backed surface has to get both right: how a DB-first
query is configured so it actually serves SQLite while offline, and how consumers tell "offline"
apart from "loading" and "error".

## 1. DB-first queries must use `networkMode: 'always'`

TanStack Query defaults to `networkMode: 'online'`. Under that default, while
`onlineManager` reports offline a query is paused _before its `queryFn` runs_.
For a query whose `queryFn` reads SQLite that means the DB read never executes: on a cold offline launch there is no memory cache and no persisted
snapshot, so the query sits in `pending`/`paused` forever. That is the "loads forever"
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

> Do NOT flip the global default in `QueryProvider`. Pure-network queries
> (e.g. balance history, price history, asset search) must keep pausing until
> their own surface tickets give them explicit offline UX. Flipping the global
> default would make them throw offline instead.
>
> Charts follow this. `useAccountBalancesHistoryQuery`,
> `useAccountsAssetsBalanceHistoryQuery` and `useAssetPriceHistoryQuery` stay pure-network, so
> `networkMode` is untouched and they still pause offline. `BalanceLineChart` (shared by
> `WealthChart`, `AssetPriceChart` and `AssetWealthChart`) renders the pause via a colocated
> `useBalanceLineChart` hook, in the order data, offline, error, loading, empty. Its retry reads
> `hasInternet` at press time and, while offline, opens the standard informational bottom sheet
> (`ConfirmActionContent`) rather than dispatching a doomed request or silently doing nothing.
> `PriceTrend` follows the same contract via `usePriceTrend`, hiding itself when paused with no
> cached data. The chart surface deliberately deviates from §2's `isError` before `isPaused`
> precedence: it collapses an errored query on a known-offline device into the offline surface,
> because a retry can't act on the error until connectivity returns.

### Guarding the network segment

Some DB-first `queryFn`s also touch the network (self-heal fetches, load-more
pages). With `networkMode: 'always'` those segments now run while offline too,
so they must not reject the whole `queryFn`:

- If the network path is already wrapped so its errors are caught/swallowed (the
  account syncer) or it uses `Promise.allSettled` (asset detail API fallback),
  nothing more is needed and the DB read still resolves.
- Otherwise, guard explicitly. `useTransactionHistoryQuery` reads the first page
  from the DB and only hits the network for load-more pages; it checks
  `onlineManager.isOnline()` before the network branch and returns a terminal
  page when offline, so the DB-backed first page stays rendered and the query
  never flips to `isError`.

> `onlineManager.isOnline` is a method. Call `onlineManager.isOnline()`, not
> `onlineManager.isOnline`.

### Persisting network-only chart snapshots (the exception to the exclusion rule)

The intro rule excludes DB-backed queries from persistence because SQLite is
already the cache. Chart-history queries are the opposite case: they are
network-only (no SQLite table backs them) and carry no PII, so the last
successful snapshot is exactly what lets a chart show last-known data on a
cold, offline launch. `apps/mobile/src/providers/query-persistence.ts`
allowlists two query-key predicates into `shouldDehydrateQuery`, dehydrated
only when the query last resolved with `status === 'success'`:

- `isAccountBalancesHistoryQuery` for `['accounts', 'balance-history', …]`
- `isAssetPriceHistoryQuery` for `['assets', 'prices', 'history', …]`

The per-account asset-history key (`['accounts', 'assets', 'balance-history',
…]`, used by `AssetWealthChart`) is deliberately _not_ allowlisted. Persistence
is scoped to exactly those two keys.

### `CHART_QUERY_TIMEOUT_MS` is 30 s on purpose

`CHART_QUERY_TIMEOUT_MS` (`packages/shared/src/models/constants.ts`) is 30 000 ms
rather than ky's 10 s default, because these aggregation endpoints routinely
exceed 10 s. Lowering it needs real latency measurements, and the offline retry
short-circuit above already removes the long doomed wait, since a retry pressed
while offline never dispatches the request.

## 2. The paused-state render contract

Offline is not an error, and it is not "loading". Use `getQueryRenderState` from
`@perawallet/wallet-core-shared` to normalise any `useQuery`/`useInfiniteQuery` result into the
shared shape:

```ts
const { data, isPending, isPaused, isFetching, isError, error } =
    getQueryRenderState(query)
```

Precedence, highest first: `isError`, `isPaused`, `isFetching`, `isPending`. The flags and why
`isPending` is deliberately narrower than TanStack's own are documented on `getQueryRenderState`
itself (`packages/shared/src/api/query-render-state.ts`).

Screens do not hand-roll the offline fork. `apps/mobile/src/components/OfflineTolerantView` renders
the shared offline surface, the no-Pera-backend surface and optionally the error surface in place of
its children; each prop's exact meaning is on the component's own props type. Callers keep owning
`data`, `loading` and `empty`.

The one thing worth repeating here, because it spans every caller: **`isOffline` is computed by the
caller's hook, not by the component.** The honest signal is per-query
(`isPaused || (isError && !hasInternet)`), not per-device, because a screen with cached data is not
"offline" just because the radio is off.

`BalanceLineChart` predates the component and keeps its own five-arm `renderState` switch, rendering
identical copy and icons.

## Offline writes: fail fast, roll back, say why

`OfflineTolerantView` covers offline _reads_. Offline _writes_ are a different
problem: the request has already been attempted, and something local may have
been changed optimistically.

Every remotely-synced write must satisfy four properties:

1. The optimistic local write is applied immediately, so the control responds.
2. The network call is attempted immediately, never queued and never paused.
   `mutationDefaults` (`networkMode: 'always'`) guarantees this.
3. On rejection the local write is reverted, and `showError` from
   `@hooks/useErrorToast` surfaces cause-appropriate copy. Connectivity
   failures get `errors.network.no_connection.*`, everything else the standard
   error mapping.
4. Once the interaction settles, persisted local state equals what the backend
   was last told.

Property 4 is the one that bites. Persisted Zustand stores survive a restart,
so an optimistic value the backend never received becomes permanent
divergence. Never leave one behind.

`apps/mobile/src/hooks/useAccountNotificationToggle.ts` is the reference
implementation, and it is deliberately a _single_ hook shared by both call sites:
the duplicated version it replaced had one copy silently missing the network
call.

Toggles are also serialised per address, app-wide: the in-flight guard inside
`useAccountNotificationToggle` is module scope, shared by every hook instance,
not just the one that started the request. `isTogglePending(address)` reports
an in-flight request, and a second call for the same address (from any
instance) early-returns without touching the store. Two overlapping failures
would otherwise roll each other back to the wrong value, violating property 4.
Screens should use the pending flag to disable the control rather than let the
tap be silently dropped, and both `NotificationSettingsList` and the
account-options sheet (`useAccountOptions` → `AccountOptionsContent`) do.

The guard itself is shared app-wide; `isTogglePending`'s _reactivity_ is not.
Each hook instance only re-renders for toggles it started itself, so a second
mounted instance of the hook (e.g. a freshly-opened account-options sheet)
renders its control as enabled until it makes its own call, at which point the
shared guard still returns `false` immediately with no store write, just
without the row having visually disabled itself first. This is intentional
scope rather than a gap: cross-instance reactivity would need a store or
subscription, which was judged disproportionate for this guard. The JSDoc on
`isTogglePending` in `useAccountNotificationToggle.ts` carries the full
reasoning.

There is deliberately no offline outbox or replay queue for user-initiated
writes. Notification mutes do not need one:
`apps/mobile/src/hooks/useDeviceAccountRegistrations.ts` joins the accounts store
with persisted notification preferences into every device-registration payload,
so mutes travel with each registration rather than needing a replay step.

### Why DB-first hooks still expose `isPaused`

A DB-first query with `networkMode: 'always'` never actually pauses, so its
`isPaused` is always `false`. It is still exposed on those hooks' result types
(`useAccountSummaryQuery`, `useAccountAssetsQuery`, `useAccountBalancesQuery`,
`useAssetPricesQuery`, `useTransactionHistoryQuery`, …) so that screens can
consume one uniform, paused-aware shape regardless of whether the underlying
query is DB-first or pure-network. Settings writes and the currency-rate notice
are the exception: they read connectivity from `useNetworkStatus().hasInternet`
rather than any query's `isPaused`.
