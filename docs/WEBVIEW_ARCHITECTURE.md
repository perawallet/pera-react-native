# WebView Architecture

How the RN app talks to the web apps it hosts (Discover, `discover-mobile`,
dApps) over the in-app webview, and what that surface is and is not trusted to
do. The bridge contract below is protocol v3.

The wire format is JSON-RPC 2.0 posted through
`window.ReactNativeWebView.postMessage`; responses are injected back via
`window.postMessage`.

Source of truth in code:

- Method set: `apps/mobile/src/modules/webview/hooks/bridge-methods.ts`
  (`PERA_WEBVIEW_BRIDGE_METHODS`), pinned by
  `apps/mobile/src/modules/webview/hooks/__tests__/bridge-methods.test.ts`.
  **Changing the method set requires updating this doc and that test.**
- Handlers: `apps/mobile/src/modules/webview/hooks/usePeraWebviewInterface.ts`
- Page-side injected API:
  `apps/mobile/src/modules/webview/components/PWWebView/injected-scripts.ts`

## Version negotiation

`getSettings` returns `protocolVersion: '3'`, and that is the negotiation signal.
Web code must key off it, not off URL query params (the native apps historically
sent `version=5` as a query param; RN does not) and not off the injected
`peraMobileInterface.version` (`'2'`, the injected-surface generation).

## Security model

- `requireSecure` guard: guarded methods run only while the webview's
  current origin matches `config.discoverBaseUrl` (re-checked on every
  navigation). Otherwise the page gets `-32001 Unauthorized`.
- Bridge token: a per-load secret is stamped onto every message by the
  main-frame-only injected script. Unstamped (subframe or forged) messages are
  dropped before dispatch.
- No TLS pinning on the webview. The app pins its API traffic, but that hooks
  the native HTTP stacks (OkHttp, `NSURLSession`) and webview traffic never
  passes through either. Pinning here was considered and deferred:
  `react-native-webview` exposes no SPKI server-trust hook on iOS, and on
  Android the threat is a rogue-but-trusted CA, whose certificate validates
  cleanly, so `onReceivedSslError` never fires and cannot detect it. Revisit
  only if the library gains a real hook; the controls above are what bound the
  exposure meanwhile, and a MITM gets read access to addresses and the device
  id, never silent signing.

## Method inventory

| Method                      | Params                                                                  | Response                                                                                                                                | requireSecure |
| --------------------------- | ----------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------- | ------------- |
| `pushWebView`               | `{ url, title?, isFavorite? }`                                          | none; opens a stacked in-app webview                                                                                                    | yes           |
| `openSystemBrowser`         | `{ url }`                                                               | none; `-32602` if the OS cannot open it                                                                                                 | yes           |
| `canOpenURI`                | `{ uri }`                                                               | `{ supported: boolean }`                                                                                                                | yes           |
| `openNativeURI`             | `{ uri }`                                                               | none; Pera deeplinks route in-app, others via OS, and `-32602` if unsupported                                                           | yes           |
| `notifyUser`                | `{ type: 'message', message }`                                          | none; shows a toast                                                                                                                     | yes           |
| `getAddresses`              | none                                                                    | `Array<{ name, address, type }>`, signing-capable accounts only                                                                         | yes           |
| `getSettings`               | none                                                                    | app/device/theme/network/currency payload incl. `protocolVersion: '3'`; `language` is the app locale, `region` the device's (see below) | yes           |
| `getDeviceId`               | none                                                                    | action message `{ action: 'getDeviceId', payload: <id> }`, not a JSON-RPC result                                                        | yes           |
| `getPublicSettings`         | none                                                                    | `{ theme, network, currency, language }`; `language` is the app locale, see below                                                       | no            |
| `onBackPressed`             | none                                                                    | none; host handles back navigation                                                                                                      | no            |
| `logAnalyticsEvent`         | `{ name, payload }`                                                     | none; forwarded to the analytics provider                                                                                               | yes           |
| `closeWebView`              | none                                                                    | none; closes the hosting webview                                                                                                        | no            |
| `requestTransactionSigning` | `{ txns: Arc0001WalletTransaction[], opts?, metadata }`                 | `(base64 \| null)[]` after user approval; rejections and errors as JSON-RPC errors                                                      | yes           |
| `requestDataSigning`        | ARC-60 wire payload (`StdSigData` + `metadata`) or `{ data, metadata }` | `base64[]` signatures after user approval                                                                                               | yes           |
| `walletConnect`             | `{ uri }`                                                               | none on success; the session continues through the WC approval sheet, errors relayed                                                    | no            |

`getDeviceId` is also pushed proactively (same action shape) whenever the
device id changes after load, so the web app can refetch id-keyed state.

## The `language` field

Both `getSettings` and `getPublicSettings` report `language`. It is the app's resolved UI
locale, meaning i18next's `i18n.language` after `resolveLocale`, and not the
device locale or the raw stored preference.

Three consequences web code should know:

- It is a bundle tag, so it may have no region. The shipped set is `en`, `de`,
  `es`, `fr`, `tr`, `pt-BR`, and only Brazilian Portuguese carries a region.
  Match on the language subtag; do not assume `xx-YY`. Historically
  `getPublicSettings` sent a constant `en-US` and `getSettings` echoed the
  device locale (`en-US`, `tr-TR`, …), so region-qualified tags used to be the
  norm and no longer are.
- `en-XA` can appear. That is the dev pseudolocale, deliberately forwarded
  rather than masked so a tester can see the mismatch it exists to expose.
- `en-US` is the fallback, used when i18next has not resolved a locale yet.
  `getPublicSettings` is unguarded, so it can be called before app bootstrap has
  run `changeLanguage`.

`region` is a separate field and still comes from the device
(`getDeviceCountry`). The language picker does not change where the user is, so
the two fields answer different questions and can legitimately disagree: a user
in Germany reading the app in Turkish reports `region: 'DE'`, `language: 'tr'`.

Whether the Discover web app can serve every locale the wallet can select is a
separate question from what this bridge reports.

## RN-only additions (intentional)

`requestTransactionSigning` and `requestDataSigning` exist only in the RN bridge.
Neither native app exposes webview signing, because native in-browser signing
goes through WalletConnect only. They are deliberate additions, gated by:

- the `requireSecure` origin allowlist, and
- the interactive signing pipeline, where every request surfaces a user approval
  sheet and nothing is signed silently. `requestDataSigning` additionally
  preflights that the requested signer account can sign the payload type.

## Unknown / legacy methods

Anything outside the inventory gets `-32601 MethodNotFound`, plus:

- a `webview_bridge_method_not_found` analytics event (method name + source
  URL) so contract drift is observable in the field, and
- a `console.warn` in dev builds.

The legacy `peraMobileInterface` native-routing methods
(`pushTokenDetailScreen`, `handleTokenDetailActionButtonClick`,
`pushNewScreen`, `openDappWebview`, `closePeraCards`) are intentionally not
implemented, because pages use `pushWebView` and `openNativeURI` deeplinks
instead. Two legacy names survive as injected
page-side aliases only, `pushDappViewerScreen` for `pushWebView` and
`getAuthorizedAddresses` for `getAddresses`. As raw wire methods they are
unsupported.

## Injected page-side API

- `window.peraRPC`: `sendJsonRPCMessage(request)`, `sendRNMessage(action, params)`
- `window.peraMobileInterface`: `handleRequest(request)` plus per-method
  wrappers for the inventory above (and the two legacy aliases); `version: '2'`

## Wallet → page messages

- JSON-RPC results/errors: `window.postMessage(<object>)` with the request `id`
- Notifications (no `id`): `onHostContextChanged`
- Action strings (`event.data` is a JSON _string_): `getDeviceId`,
  `handleBrowserFavoriteButtonClick`

## Error codes

| Code     | Meaning                                         |
| -------- | ----------------------------------------------- |
| `-32601` | Method not found (outside the v3 contract)      |
| `-32602` | Invalid/missing params, unsupported URL/URI     |
| `-32603` | Internal error, user rejection, offline         |
| `-32001` | Unauthorized (`requireSecure` blocked the call) |
