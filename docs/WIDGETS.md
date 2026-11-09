# Home-screen widgets

Pera's home-screen widgets are native code per platform: SwiftUI/WidgetKit on iOS, Jetpack Glance on
Android. React Native cannot render inside a widget, so no widget UI is shared between platforms.
What is shared is everything that feeds them: the app computes a display-ready **snapshot** in
TypeScript and hands it to the widgets through a small native bridge. This doc is that shared
contract. What each widget shows, its options, its taps and how each platform builds them are in
[WIDGETS_IOS.md](WIDGETS_IOS.md) and [WIDGETS_ANDROID.md](WIDGETS_ANDROID.md).

```text
RN app (JS)                          native bridge                widgets
───────────                          ─────────────                ───────
queries + stores ─► buildWidgetSnapshot ─► writeSnapshot(json) ─► widget storage ─► render
NFT image URLs   ─────────────────────► syncImages(items)    ─► cached image files
                                                                  Pera backend ◄─ own fetches
```

## Platforms

|                  | iOS                                                  | Android                                      |
| ---------------- | ---------------------------------------------------- | -------------------------------------------- |
| Widget UI        | WidgetKit extension                                  | Glance, inside the native bridge module      |
| Snapshot storage | App Group shared with the extension                  | App-private SharedPreferences `pera_widgets` |
| Scheduler        | WidgetKit timelines                                  | WorkManager                                  |
| Scan shortcut    | Control (Control Center, Lock Screen, Action button) | Quick Settings tile                          |

Both platforms also offer the scanner from the app icon's long-press menu ("Scan QR Code",
`useAppQuickActions`, set at runtime so the title follows the app language).

| Widget                                                              | iOS | Android |
| ------------------------------------------------------------------- | --- | ------- |
| Portfolio, Transactions, Price, Receive QR                          | ✓   | ✓       |
| Portfolio & Transactions with a tab bar                             | ✓   | ✓       |
| Portfolio & Transactions with a flip button                         | ✓   | —       |
| NFTs                                                                | ✓   | —       |
| Cloud Backup, Passphrase Backup, Backups                            | ✓   | —       |
| Inbox, Inbox List, Signatures, Notifications, Inbox & Notifications | ✓   | —       |

## Where the code lives

| Piece                    | Location                                                                                                                                  | Knows about                                                      |
| ------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------- |
| Snapshot schema and sync | `widgets` module in the mobile app (`buildWidgetSnapshot`, `WidgetSnapshotSync`)                                                          | Accounts, currencies, settings, i18n, network                    |
| Platform service         | `WidgetsService` in `extensions/platform`, RN implementation in `extensions/platform-react-native`, no-op in `extensions/platform-chrome` | The bridge methods                                               |
| Native bridge            | Expo module `PeraWidgets` in `apps/mobile/native-modules/widgets/`                                                                        | Where the snapshot and images live; on Android, also the widgets |
| iOS widgets              | `apps/mobile/targets/widget/`, with the snapshot `Codable` in `apps/mobile/targets/_shared/`                                              | [WIDGETS_IOS.md](WIDGETS_IOS.md)                                 |
| Android widgets          | `apps/mobile/native-modules/widgets/android/`                                                                                             | [WIDGETS_ANDROID.md](WIDGETS_ANDROID.md)                         |

The snapshot logic stays an app module: it projects existing domains for one mobile-only surface.
Promote it to `packages/` if a second consumer appears.

## The snapshot

One versioned JSON document, defined once as a Zod schema in TypeScript (`snapshot.ts` in the
`widgets` module) and mirrored as a Swift `Codable` and a Kotlin data class.

```ts
{
  version: 1,
  locale: 'pt-BR',                       // the app's active locale, not the device's
  theme: 'light' | 'dark' | 'system',    // the app's theme setting
  network: { isMainnet: boolean, label: 'TestNet' },
  strings: { updated: '…', hidden: '…', inboxWaiting: '{count} waiting', … },  // translated labels
  priceFeed: {
    backendUrl, apiKey, currencyCode: 'EUR',
    pinning: { publicKeyHashes: string[], expiresAt: '2027-07-08T00:00:00Z' } | null,
  } | null,
  portfolioFeed: { accounts: [{ address, name }], period: 'one-week' } | null,
  assetOptions: [{ assetId, name, unitName }] | null,
  algoPrice: { formatted: '€0.19', asOf: 1727600000000 } | null,
  portfolio:
    | { state: 'visible', formatted: '€1,234.56' | null, algoFormatted: '6,500.12 ALGO', asOf: number }
    | { state: 'hidden' }
    | null,
  nfts:
    | { state: 'visible', items: [{ assetId: '286018494', title, collectionName?, imageKey }] }
    | { state: 'hidden' }
    | null,
  backup: {
    cloud: { state: 'notSetUp' | 'partial' | 'failed' | 'backedUp', title, detail | null } | null,
    passphrase: { state: 'needed' | 'backedUp', title, detail | null },
  } | null,
  inboxFeed: {
    deviceId, addresses, localAddresses, accountNames: [{ address, name }],
    notifications: { backendUrl, deviceId } | null,
  } | null,
  receiveTargets: [{ address, name, paymentUri, chain: 'algorand:…' | null }] | null,
}
```

- **Decoding.** Every top-level field after `version` is optional on both platforms, so an older
  widget never fails on a field a newer app adds. Inside a field they differ: Swift requires the
  members a widget can't render without, so a malformed field fails the whole decode and the widget
  shows its placeholder; Kotlin makes every member nullable.
- **Values cross the bridge as formatted strings.** No `Decimal` or `number` amount is ever
  serialised. The self-refreshing widgets (below) format what they fetch with Swift and Kotlin
  ports of `formatCurrency`: fiat at the currency's digits capped at 2, half-up, `< $ 0.01` below the
  smallest unit; unit prices at 2–6 decimals. Their tests assert strings generated from the TS
  functions, so a live value and the app's snapshot fallback render the same.
- **`asOf` is epoch milliseconds from the price query's `dataUpdatedAt`**, not the write time, so
  "Updated" is honest after an offline launch. It doesn't count as a change on its own.
- **Strings with a count carry a literal `{count}`** (`inboxWaiting`, `inboxToSign`): the widget
  substitutes the number, so the translation keeps its own word order.
- **Asset IDs are decimal strings**; they can exceed 2^53.
- **The app clears the snapshot when the wallet has no signing accounts** on the widgets' chain, so
  a watch-only wallet gets the placeholder everywhere.

## Security and privacy

Widgets sit outside the app lock. The PIN or biometrics protect the app, not the home screen:
anyone holding an unlocked phone sees what the widgets show, as with a notification preview. What
the snapshot may hold follows from that.

- **Never in the snapshot:** keys, passphrases, or anything that signs.
- **Stored, never rendered:** the accounts' addresses (`portfolioFeed`, `inboxFeed`), device ids,
  and the `X-API-Key` the app already ships with, so the widgets can fetch between launches. Only
  Pera can read the storage (an App Group on iOS, app-private SharedPreferences on Android), and
  `apps/mobile/plugins/withExcludeDataFromBackup.js` keeps it out of device backups on both.
- **Rendered:** balances, charts, transaction rows, NFT images, inbox counts and, in Receive QR
  only, one address and its QR.
- **A tap goes through the app lock.** Every tap is a deep link into the app; with the app lock on,
  the lock screen covers the destination until the user unlocks, and signing still asks for the PIN
  or biometrics. The widgets never see the lock's state, so turning the PIN on changes nothing on
  the home screen.
- **Privacy mode** is what keeps holdings off the home screen. `portfolio` and `nfts` are written
  as `{ state: 'hidden' }`, and `portfolioFeed`, `assetOptions`, `inboxFeed` and `receiveTargets`
  are `null` (the builder enforces this even if a caller passes them), so the snapshot holds no
  address, account name or NFT. A widget's saved options still hold the account picked in them, as
  an address. Prices are public and always written. Backup status is written too: it reveals no
  holdings, and its prompt is the point of the widget.
- **Locked phone.** Neither platform offers a widget on the lock screen, where it would be readable
  without unlocking. iOS still shows home-screen widgets on a locked phone in StandBy and on the Mac
  desktop, so it redacts their sensitive content until unlock; Android's home screen isn't visible
  on a locked phone.
- **Settings screens skip the PIN.** Edit Widget on iOS and the widget settings screen on Android
  list account and asset names without asking for it, as the widget itself would, and only on an
  unlocked phone.
- **Network.** The widgets' own requests carry the app's certificate pins (below).

## When the app writes it

`WidgetSnapshotSync`, a component that renders nothing, is mounted beside the app content in
`RootComponent`, so a price or sync tick re-renders only it.

- It writes when the snapshot differs from the last one written, `asOf` aside, so an unchanged
  price poll does not spend a widget reload.
- It writes on the transition to background, so the widgets match what the user last saw. The
  native side redraws only when the data differs from what it already holds.
- **It never overwrites with pending or errored data.** If inputs are not ready,
  `buildWidgetSnapshot` returns `undefined` and the previous snapshot stays; a read that errors
  keeps its last good value (`useSettledWidgetValue`), and a failed NFT read never purges images.
- **Privacy mode is written at once**, even while price or backup status is pending, so a visible
  snapshot can't outlive the switch.
- **Delete all data raises a wipe guard first** (`useWidgetWipeStore`) and clears the widgets after
  the stores reset, so no write or background re-write lands in between.

## Language and theme

- Every user-visible label in a widget comes from `snapshot.strings`, translated in JS from the
  normal locale bundles under a `widgets.*` namespace, so widgets render in the app's language,
  which can differ from the device's. New keys must land in all locales; `pera/locale-key-parity`
  enforces it. The Price widget's "24h" and "ID" are the exception: iOS takes them from the
  extension's catalog in the device language, and Android has them in English.
- The widget gallery text and each widget's options follow the device language instead, from each
  platform's own string resources.
- The snapshot carries the app's `theme`, and widgets apply it when it is `light` or `dark`.
  Colours are copies of the app's tokens (`apps/mobile/src/theme/tokens/light.ts` and `dark.ts`),
  hand-copied per platform; keep the token names identical so a search finds every copy.
- Off MainNet, widgets draw the app's yellow network bar (`testnetBg`/`testnetText` with
  `network.label`), so TestNet value is never mistaken for real funds on the home screen.

## Self-refreshing widgets

App-pushed snapshots go stale whenever the app is not opened, so Portfolio, Transactions, Price
and the inbox widgets fetch for themselves every 30 minutes, and 5 minutes after a failed fetch.
After a failed fetch, Android keeps showing the last values it fetched; iOS keeps none, so it falls
back to what the app last wrote where the snapshot has it (the all-accounts portfolio, the ALGO
price) and shows `—` otherwise. "Updated" shows a clock time ("Updated 14:05", plus the day once
not today). The other widgets change only when the app writes, except an NFT widget set to move on
at an interval.

### Price

- `GET /v1/public/assets/{assetId}/` gives `usd_value` and `usd_value_24_hour_ago`, so one call
  yields the price and the 24h change.
- `GET /v1/currencies/{code}/` gives the USD rate for a non-USD currency.
- `GET /v1/assets/price-chart/?asset_id={assetId}&period={period}` feeds the chart.

The app supplies `priceFeed`: the selected network's backend URL, the `X-API-Key` the app already
sends, and the preferred currency (USD when that is ALGO, since "1 ALGO = 1 ALGO" says nothing). It
is `null` on networks without a Pera backend. A failed fetch of ALGO in the app's currency falls back
to the app's last `algoPrice`; any other pair shows no price without a live one. Priced in ALGO, an asset's price, 24h change and chart are all ratios to ALGO's own
(`usd_value` over ALGO's, then and 24h ago); a chart whose series doesn't line up with ALGO's is
dropped rather than drawn wrong.

The price widget prices any verified asset in any quote currency, defaulting to ALGO in the app's
currency. The asset list is `assetOptions`: verified, non-collectible assets the signing accounts
hold. A look-alike asset is a phishing surface on a home screen, so the picker offers verified
assets only, the widget always shows the verified badge and, for anything but ALGO, the asset id,
and every fetch re-checks `verification_tier`: an asset downgraded after it was picked shows no
price. The currency list is loaded live from `GET /v1/currencies/`, plus ALGO as a quote for other
assets.

### Pinning

`priceFeed.pinning` carries the app's root-CA pins when its Pera API pinning flag is on and the
backend host qualifies (`buildPinningConfig`). Every widget request then requires a pinned key in
the verified chain and is treated as a failed fetch otherwise; after `expiresAt` the pins are
ignored, as the app's pinning library does. The flag is read on each write, so the remote kill
switch reaches the widgets with the next snapshot.

### Portfolio

`GET /v1/wallet/wealth/?account_addresses=A,B&period=<period>` is the endpoint behind the app's home
chart. Its last point is the current total, so one call gives the amounts and the chart. The app
supplies `portfolioFeed`: the signing accounts' addresses and names, and its `chartPeriod`
preference, so a widget left on "Default" charts the same period as the home screen. Addresses are
comma-joined because that is how the app's HTTP client serialises arrays.

### Transactions

`GET /v1/accounts/{address}/transactions/?limit=N` per account, merged newest first and deduplicated
by id (a transfer between two of the user's accounts appears in both). "Portfolio" reads at most
five accounts so the fetch fits a widget refresh's few-second budget. Rows follow the app's own
rules (`summarize.ts` and the history transformers in `chain-algorand`), on both platforms: each
row reads from the side of the account whose page it came from, the amount is the transaction's own
(plus a close-out sweep) rather than the fee-inclusive balance impact, ALGO is always 6 decimals
even when the backend sends its `asset(0)` placeholder, and key registrations, heartbeats and asset
admin rows show as a plain "Transaction". Pages stay in account order, so a transfer between two
of the user's accounts reads from the same side on every refresh. Labels reuse the app's
`transactions.list_item.*` translations via `snapshot.strings`, because the backend's
`interpreted_meaning` is English only.

### Inbox

The inbox widgets make the requests the app makes: `POST /v1/inbox/{device}/` with the accounts'
addresses, and `GET /v2/devices/{device}/notifications/`. The app shares the device ids, the
addresses and every account's name in `inboxFeed`, which is null in privacy mode, where the network
has no inbox, and without a device id or addresses.

- **Only what still needs the user counts:** a sign request counts while it can still be signed or
  declined (`pending` or `ready`, the app's `ACTIONABLE_SIGN_REQUEST_STATUSES`); anything later is
  history. Asset inboxes with no requests are dropped.
- **Rows are labelled by name, never address,** from `accountNames`, which covers every account so
  a shared account's request shows its name.

## Deep links

Every widget tap is a `perawallet://app/` link the app already understands, or one added for the
widgets.

| Link                          | Opens                                                                              |
| ----------------------------- | ---------------------------------------------------------------------------------- |
| `portfolio`                   | Home, with the account drawer open on the portfolio                                |
| `account-detail?address=`     | That account; `tab=history` opens its History tab, `chain=` (CAIP-2) its network   |
| `scan`                        | Home's QR scanner                                                                  |
| `inbox`, `notifications`      | The Messages tab on the inbox or the notifications                                 |
| `sign-request`, `asset-inbox` | That sign request, or that account's asset inbox                                   |
| `cloud-backup`                | The cloud backup stack, which picks intro, setup or overview itself                |
| `passphrase-backup`           | The backup of the first account that needs one at tap time, or home when none does |
| `nft-detail`                  | That NFT, from whichever account holds it                                          |
| (the bare app link)           | The app                                                                            |

- **Screens that mount late.** The drawer, the account's tabs and the scanner may mount after the
  link arrives, so these links set a request flag the screen consumes once mounted
  (`useAccountDrawerRequestStore`, `useAccountTabRequestStore` and the scanner's own).
- **Origin gate.** `inbox` and `notifications` only open a Messages tab, so push notifications may
  use them; a push notification may not open `scan`, `cloud-backup` or `passphrase-backup`. A web
  page needs the origin gate to open any of the five.

## Multi-page widgets

Widgets cannot scroll or take gestures, so a two-page widget switches pages with a button that runs
an action (an `AppIntent` on iOS, a Glance `ActionCallback` on Android) and redraws. The tab bar
sets its page directly, so a tap always lands where its icon says; iOS also has a flip button that
toggles. A wide widget shows both pages side by side instead, and each half is its own link. Where
the page is kept and what each platform fetches per page is in the platform docs.

## NFT images

Widgets cannot load remote images, so the app prepares them, never the widget:

- JS takes each held collectible's primary image, or the preview of its first image-type media,
  reading past the 10-NFT cap to skip collectibles with neither. It drops any URL that fails
  `httpsUrlSchema` from `@perawallet/wallet-core-shared`, and calls `syncImages([{ key, url }])`
  before writing the snapshot.
- The native module downloads each new key, writes a downsampled file where the widgets can read
  it, and deletes keys no longer listed.
- `syncImages` returns the keys it cached, and **only those go into the snapshot**, so a widget
  never references a missing file.

The download runs in the app rather than the widget because the URLs come from untrusted NFT
metadata: the app has the memory and time budget, and the widget only ever decodes a small file the
app already validated. The list only changes when the app runs anyway, so independent refresh would
gain nothing. Only iOS has an NFT widget; on Android `syncImages` downloads nothing.

## Failure behaviour

| Situation                                    | Widget shows                                                     |
| -------------------------------------------- | ---------------------------------------------------------------- |
| No snapshot, decode failure, unknown version | Pera logo placeholder                                            |
| A top-level field missing                    | That element falls back; the rest renders                        |
| `state: 'hidden'`                            | Masked value (`••••`), or the logo where nothing can be masked   |
| No signing accounts                          | Pera logo placeholder (the app cleared the snapshot)             |
| Transactions never fetched, or fetch failed  | `—` on iOS, a blank list on Android; never "No transactions"     |
| Native module absent (web, tests)            | `requireOptionalNativeModule` returns `null`; the service no-ops |

## Testing

- `buildWidgetSnapshot` carries the logic and gets the bulk of the unit tests (`snapshot.spec.ts`
  in the `widgets` module): privacy, empty accounts, pending inputs, network and locale
  propagation, NFT selection, non-https URLs dropped, only cached keys included.
- `useWidgetSnapshotWriter.spec.ts`: dedupe, write on background, no write while pending, privacy
  mode at once, image purges and the wipe guard.
- Each platform's native tests are described in its own doc.
