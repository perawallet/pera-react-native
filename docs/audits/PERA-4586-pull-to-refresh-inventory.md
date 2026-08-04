# Pull-to-refresh surface inventory — PERA-4586 (OFF-017)

Every scrollable surface in `apps/mobile/src`, with a decision. Required by the ticket's acceptance criteria: "Inventory documented in PR: every scrollable data surface, with/without refresh, decision per surface."

Baseline before this change: **two** `RefreshControl` usages existed in the whole monorepo (Inbox, Notifications), neither connectivity-aware, and two `handleRefresh` handlers were built but never wired.

## Rules applied

A surface gets pull-to-refresh when all three hold:

1. It renders network- or chain-derived data that can become stale while the screen is open.
2. It is the outermost scroller of its screen, and not inside a bottom sheet (an overscroll `RefreshControl` fights `@gorhom/bottom-sheet`'s pan-down-to-close, which claims exactly that gesture).
3. Its data has no cheaper, already-present refresh affordance (an error-state retry button, a focus effect, a tab-activate refetch).

Local/derived lists — settings menus, pickers, address books, in-memory signing pipelines, onboarding derivations — get nothing: there is no remote state to pull.

## Refresh surfaces after this change

| Surface                                                   | Container                                            | Refresh source                                                                            |
| --------------------------------------------------------- | ---------------------------------------------------- | ----------------------------------------------------------------------------------------- |
| Account overview tab (portfolio value, chart, asset list) | `AccountAssetList` → `SearchableList` → `PWFlatList` | `useSyncRefresh([address])` in `useAccountOverview`                                       |
| Account history tab                                       | `SectionList` in `AccountHistory.tsx`                | `useSyncRefresh([address])`                                                               |
| Account NFTs tab                                          | `PWFlatList` in `AccountNfts.tsx`                    | `useSyncRefresh([address])`                                                               |
| Asset detail (header + transactions)                      | `SectionList` in `AssetTransactionList.tsx`          | `useSyncRefresh([address])`                                                               |
| Inbox                                                     | `PWFlatList`                                         | existing `useInboxQuery` `isRefetching`/`refetch`, now via `PWRefreshControl`             |
| Notifications                                             | `PWFlatList`                                         | existing `useNotificationsListQuery` `isRefetching`/`refetch`, now via `PWRefreshControl` |

All six go through `PWRefreshControl`, so all six behave identically offline: the pull does not dispatch a doomed request, it pulses the offline banner and resolves.

The four account-scoped surfaces route through the sync service rather than a query `refetch()`. Their queries are DB-first (`staleTime: Infinity`, `networkMode: 'always'`, reading SQLite), so a bare `refetch()` re-reads the same local rows — the gesture would have spun and changed nothing. Inbox and Notifications are pure-network backend queries, so their own `refetch` is the correct path there.

On those four, the spinner is driven solely by the sync refresh, never by the query's `isRefetching`. Composing the two looks tempting and is wrong: the periodic sync tick invalidates transaction queries whenever a fetch succeeds, an invalidated active infinite query refetches, and the pull spinner would then appear with no gesture behind it — every tick, on a network where the should-refresh probe short-circuits.

`useSyncRefresh` dedupes by network + addresses in a module-level map, so a pull on one account tab joins the refresh another tab already started instead of duplicating the indexer fetch, and a pull after an account switch is never swallowed by a guard the previous account still holds.

## Excluded, with reasons

### Bottom-sheet scrollers — gesture conflict (rule 2)

`AccountMenu` (the account switcher, and the only host of `PortfolioView`), `AccountActionsContent`, `AccountSortContent`, `AssetSelectionList` and its wrappers (`AddAssetView`, `AccountAssetSelectionList`, `SwapToAssetSelectionList`, `OnrampPairSelectionContent`), `SwapHistoryList`, `ConnectionView`, `LedgerAccountInfoContent`, `CardCountryPicker`, `CardUsStatePicker`, `NotificationSettingsList` (sheet host), `TransactionListScreen`, `GroupDetailScreen`, `SearchableListSheet`, `CustomNetworkSheet`, the onramp/swap introduction sheets.

`AccountMenu` is the notable one: it hosts `PortfolioView`, so "the portfolio has no pull-to-refresh" is technically true of that sheet. Two independent reasons to leave it: the sheet gesture conflict, and `useAccountMenu` drives chart collapse off `contentOffset.y` through a hysteresis band added specifically to stop a collapse/expand feedback loop — a refresh spinner changes content inset and perturbs exactly that input. The portfolio value and chart the user sees on home live in `AccountOverviewHeader`, inside the overview surface that **is** wired, so the home gesture the ticket asks for exists.

### Already has a working refresh affordance (rule 3)

- `StakingScreen` — offline-guarded `handleRetry` on its error/offline state.
- `CardTransactionsScreen` — `handleRetry` on its error state.
- `OnrampHistoryContent` — refetches on tab activation.
- `PWWebView` — `pullToRefreshEnabled` on the WebView itself; WebView pull is PERA-4582's scope.
- `PeraCardOverview`, `PeraCardDetails` — card state is push-driven from the backend and re-read on focus; the card tabs have branded error surfaces instead.

### Local or in-memory data (rule 1)

`ContactListScreen`, `ConnectedSitesScreen`, `ConnectionsSettingsScreen`, `SettingsWalletConnectScreen`, `AccountPicker`, `EnableRequestScreen`, `LedgerScanScreen`, `AssetTransferRequestsScreen`, the onboarding account-selection screens (`AsbImportSelectAccounts`, `ImportSelectAddresses`, `SelectHDWallet`, `ImportRekeyedAddresses`), the developer migration screens, and the gallery catalog.

### Search and form surfaces — pull is the wrong gesture

`SearchScreen`, `AddressSearchView`, `SwapForm`, `OnrampForm`, `AssetMarkets`, `RemoveAssetsScreen`, `GroupTransactionListScreen`, `SettingsCurrencyScreen`, `CardTransactionDetailScreen` tabs. These are query-driven or single-shot: the user changes the input, not the freshness.

## Dead handlers found and resolved

| Handler                                   | Resolution                                                                                                                       |
| ----------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------- |
| `useAccountHistory.handleRefresh`         | **Wired**, and rerouted through the sync service. The `refetch` it used to call is no longer destructured.                       |
| `useAssetTransactionList.handleRefresh`   | **Wired**, same treatment.                                                                                                       |
| `useDappConnectionsStore.refetch`         | Left as-is. Local `chrome.storage`-backed store, no refresh surface — out of this ticket's scope; flagged for a dead-code sweep. |
| `useOnrampHistory.refetch`                | Not dead — consumed by the hook's own tab-activate effect, just not returned to the component.                                   |
| `useSystemNotificationPermission.refetch` | Left as-is; local permission probe, not a data surface.                                                                          |

## The Android contract a refresh-control wrapper must honour

`PWRefreshControl` wraps RN's `RefreshControl`, and on Android that wrapper is load-bearing in a way iOS never reveals. `ScrollView` does not render the control as a sibling there — it **clones the element and passes the scroll view itself as `children`**, plus a layout `style` (`Libraries/Components/ScrollView/ScrollView.js`):

```js
return cloneElement(refreshControl, {style: ...},
  <NativeScrollView ...>{contentContainer}</NativeScrollView>)
```

So any wrapper that does not spread its remaining props onto the underlying `RefreshControl` **deletes the entire list from the tree**. On a `SectionList` that shows up as an empty screen; on a FlashList it throws `LayoutManager is not initialized, layout info is unavailable`, because `StickyHeaders.compute()` asks for layout info that will now never exist. iOS renders the control as a plain child and is unaffected — which is why every historical report of this (PERA-4678, PERA-4681, PERA-4679) was Android-only.

Verified on a physical Galaxy S22 / Android 16 with the New Architecture: a plain `<RefreshControl>` element and FlashList's own `onRefresh`/`refreshing` props both render correctly, and a wrapper that swallows `children` crashes the home screen. `PWRefreshControl.spec.tsx` guards the forwarding.

## Known limitations

- **Account history, empty state.** `AccountHistory` renders its loading and empty states outside the `SectionList` on purpose (see the PERA-4676 comment in that file: an empty `SectionList` collapses to zero height inside the tab pager). There is no scrollable to pull from when history is empty, so refresh is unavailable in that state. `AssetTransactionList` uses `ListEmptyComponent`, so it does refresh from empty. Restructuring the history branch risks regressing PERA-4676 and was left out.
- **NFTs, empty state.** Same shape — `AccountNfts` swaps in `NftEmptyState` instead of the list when there are no collectibles and no search filter. Pre-existing structure, not restructured here.
- **`SearchableList` content-size backstop.** `handleContentSizeChange` re-pins the collapsed header whenever content size changes while the collapse latch is set. Refreshed data arriving can therefore snap the header away. This already fired on every background sync tick; the pull adds a new trigger for existing behavior, not new behavior. Verified that a pull itself cannot latch the collapse state — `handleScroll` only latches at `offsetY >= headerHeight`, and a pull produces `contentOffset.y <= 0`.
