# `window.pera` dApp bridge

How a web page connects to the browser extension and asks it to sign, without a
WalletConnect relay. The page-facing contract is the one an SDK (pera-connect,
use-wallet) is written against, so this document is exact about it.

Source of truth in code:

- Protocol constants and JSON-RPC codec: `packages/dapp/src/protocol.ts`,
  `packages/dapp/src/codec.ts`
- Handler: `packages/dapp/src/handler.ts`
- Page provider: `apps/browser/src/content/inject-main.ts`, relayed by
  `apps/browser/src/content/relay-isolated.ts`
- Extension transport: `extensions/platform-chrome/src/dapp/dapp-wire.ts`,
  `extensions/platform-chrome/src/dapp/transport.ts`,
  `extensions/platform-chrome/src/dapp/host-client.ts`,
  `apps/browser/src/background/dapp.ts`

## Why a Pera namespace

ARC-0027 multiplexes every wallet over one page channel and relies on each dApp
and each wallet honouring `providerId`. A dedicated namespace is unambiguous by
construction: only Pera answers `window.pera.*`. Presence of `window.pera` is
detectable by any page; that is inherent to injected browser wallets and is
accepted. Nothing else — network, accounts, identity — is disclosed before an
approved `connect`.

## Page API

Installed in the MAIN world at `document_start`, top frame only, frozen, on
`https:` pages and on `http:` loopback so local dApp development works. The
service worker independently refuses anything else, because the manifest
governs injection and the worker governs authorization.

`window.pera.version` is the negotiation signal (`'1'`).

| Method                                               | Wire method                                                        | Result                                        |
| ---------------------------------------------------- | ------------------------------------------------------------------ | --------------------------------------------- |
| `connect({ name?, description?, icons?, network? })` | `connect`                                                          | `{ accounts: { address, name }[], network }`  |
| `disconnect()`                                       | `disconnect`                                                       | `void` on the page, `null` on the wire        |
| `getAddresses()`                                     | `getAddresses`                                                     | `{ address, name }[]` (the approved accounts) |
| `signTransactions(txns, opts?)`                      | `requestTransactionSigning` `{ txns, opts? }`                      | `(base64 \| null)[]` — ARC-0001               |
| `signData(payload)`                                  | `requestDataSigning` — an ARC-60 wire object, or `{ data: [...] }` | `base64[]`                                    |
| `on(event, handler)`                                 | —                                                                  | unsubscribe function                          |

A `txns` entry is an ARC-0001 wallet transaction,
`{ txn, signers?, authAddr?, msig?, stxn?, message? }`, with `txn` base64.

Events are delivered as JSON-RPC notifications (no `id`). **Only `disconnect`
`{}` is emitted today**, when the record is removed. `accountsChanged`
`{ accounts }` and `networkChanged` `{ network }` are reserved: the handler can
send them, but nothing in the wallet produces the `WalletNotice` that would, so
an SDK must not wait on either. Re-read `getAddresses()` instead.

`requestTransactionSigning` and the ARC-60 form of `requestDataSigning` keep the
in-app webview bridge's param and result shapes (see
[WebView Architecture](WEBVIEW_ARCHITECTURE.md)) — both data paths reach
`parseArc60WireRequest` — so one SDK codec serves both. The legacy data form
does not: here `data` is an **array** of `{ data, signer, chainId?, message? }`
(`data` base64, `signer` the address to sign with) and `metadata` is neither
required nor read, where the webview takes a single `data` object and requires
`metadata` beside it.

## Semantics

- **Connect requires a user gesture.** The ISOLATED content script reads
  `navigator.userActivation.isActive` and stamps it on the request; a page
  cannot alter that world's view of it. Without activation `connect` fails
  with `-32001` and no approval surface opens — and it fails there first, ahead
  of the network checks below, whose `-32003` message names the wallet's active
  network. A `connect` from an origin that
  already has a connection resolves immediately with the stored accounts and
  needs no gesture; that is how an SDK reconnects on load.
- **One connect at a time per origin.** The wallet claims the origin's connect
  slot synchronously, so of two concurrent `connect()` calls one is answered
  and the other gets `-32600`. Within one page the provider shares a single
  in-flight promise across concurrent calls — React StrictMode's double-invoke
  makes those routine — so the code surfaces only when two tabs of the same
  origin race.
- **Peer identity is fixed at connect.** `name`/`description`/`icons` come from
  the page; a missing or blank `name` falls back to the origin's host. `name` is
  truncated at 100 characters and `description` at 300. `url` is
  always the browser-verified origin, which is also the connection id — one
  connection per origin, however many tabs. That origin also rides on every
  sign request as `verifiedOrigin`, which is what the signing pipeline's ARC-60
  domain-mismatch check compares against; it never reads `peer.url` for that,
  because on WalletConnect the peer URL is dApp-asserted. `icons` are kept only if `https:`
  and same-origin as the page (an icon URL is fetched when the approval renders,
  which tells its host when that happened), de-duplicated, first 4 kept. A
  `metadata` param naming the requester is ignored on the sign methods: the
  approval shows the connection's own peer record. ARC-60's own `metadata`
  (scope, encoding) is part of the payload and is honoured. **A reconnect never
  refreshes the stored record**: a dApp that rebrands keeps the name and icon
  the user approved until it disconnects and connects again.
- **The account list is filtered on every answer.** `connect` and
  `getAddresses` return the approved accounts intersected with the wallet's
  current signing-capable ones, so an account deleted or demoted since approval
  disappears from the page's view without the connection itself changing.
- **Network.** The connection is network-agnostic. `connect` reports the
  wallet's active network; a `network` option naming a different one fails
  with `-32003`. A `custom` network is reported as the baked network sharing
  its genesis hash and refused otherwise, so a forged custom-network record can
  never make the wallet claim MainNet.
- **Not connected** → `-32001` on `getAddresses` and the sign methods.
- **Payload caps are refused at the service worker**, before an approval opens,
  all as `-32602`:

    | Cap                             | Value  | Applies to                          |
    | ------------------------------- | ------ | ----------------------------------- |
    | `MAX_ID_LENGTH`                 | 64     | `id`, stringified                   |
    | `MAX_METHOD_LENGTH`             | 64     | `method`                            |
    | `MAX_DAPP_REQUEST_JSON_LENGTH`  | 1 MiB  | the whole request, JSON-stringified |
    | `MAX_TRANSACTION_SIGN_REQUESTS` | 1000   | `txns.length` (empty also fails)    |
    | `ARC0001_MAX_TXN_B64_LENGTH`    | 64 KiB | each `txns[i].txn`                  |

    The blanket JSON cap binds long before the per-group one: 1 MiB over 64 KiB
    leaves room for roughly **16** maximum-size transactions, not 1000. Size the
    group against that, not against `MAX_TRANSACTION_SIGN_REQUESTS`.

- **Timeouts.** The wallet answers a proposal or request that goes unanswered
  for `DAPP_PROPOSAL_TTL_MS` / `DAPP_REQUEST_TTL_MS` — 5 minutes each — with
  `-32004`, and settles any approval surface still open for it, so no approval
  can be accepted afterwards. `DAPP_PAGE_TIMEOUT_MS` is that budget plus ten
  seconds (5 min 10 s), so the page's backstop loses the race and the wallet's
  own terminal answer is what a dApp sees.

## Errors

A rejected call rejects with a `PeraProviderError` carrying `code`, `message`
and, when the wallet sent one, `data`.

`-32002` is a `connect` outcome. The handler rejects a declined proposal
in-process, so the user's "no" keeps its identity all the way to the page. A
sign request does not: the approval window answers the offscreen host with a
decision rather than an error, so every signing failure — a user rejection
included — reaches the page as `-32603`, and a cancelled
`signTransactions`/`signData` cannot be told apart from a wallet fault.

ARC-0001's numeric codes do not reach `code` either. `Arc0001Error` keeps
4100/4200/4300 in a `code` field that no throw site folds into the message, and
the handler maps only a cancel and the registry's `invalid-payload`, so the
number is not recoverable from the page at all — only the human-readable message
can be. (The in-app webview bridge shares the codec but not this realm hop, and
maps 4100 to `-32001` and the rest to `-32602`; that mapping is the webview's
alone.)

What a `-32603` message may say is bounded twice. `sanitizeErrorForWebview` is a
deny-by-default allowlist keyed on `error.name`, because an error class not
named in it may interpolate wallet-held data, and it truncates whatever it
allows at `MAX_ERROR_LENGTH` (200 characters). A `-32002` reject reason is not
filtered that way: `sanitizeRejectReason` strips control characters and
truncates at the same limit, so its length and encoding are bounded but its
content is not. An error rebuilt as `new Error(message)` crossing a realm hop
has lost its `name`, so it falls to the generic copy regardless of what it was.

| Code     | Meaning                                                           |
| -------- | ----------------------------------------------------------------- |
| `-32600` | Invalid request: a `connect` is already pending for this origin   |
| `-32601` | Method not found                                                  |
| `-32602` | Invalid or oversized params                                       |
| `-32603` | Internal error (message sanitized; never wallet-held data)        |
| `-32001` | Unauthorized: not connected, no user gesture, or untrusted origin |
| `-32002` | User rejected the `connect` proposal                              |
| `-32003` | Network not supported                                             |
| `-32004` | Request timed out                                                 |

## Extension transport

Page → MAIN provider → per-load randomized `CustomEvent` channel → ISOLATED
relay → service worker (`pera-dapp-page-request`) → offscreen handler
(`pera-dapp-host-request`). Answers go offscreen → service worker
(`pera-dapp-host-response`) → `chrome.tabs.sendMessage` to the requesting tab
(`pera-dapp-page-response`); notifications are broadcast to every tab and the
relay drops anything not for its own origin.

The service worker is the trust boundary: origin is `sender.origin`, must be a
secure context, and the request must pass `isWithinDappPayloadBounds` before it
is forwarded or held anywhere. That gate ships from the package's `./bounds`
subpath and the wire types from `./wire`; both reach nothing beyond the two
constants subpaths that define the caps, so an MV3 bundle stays free of the
package's runtime dependencies, which the index entry pulls in.

The worker acks immediately and holds no state; pending requests live in
offscreen with their expiry, so an evicted worker never strands a page without
a terminal answer.

The handler is a `ConnectionHandler` ([Connections](CONNECTIONS.md)): `connect`
is a `connection-proposal`, signing is a `connection-request`, and the record
shows in the connections settings screen like any other kind.

## The dApp's own connect modal

A dApp on `@perawallet/connect` renders its own wallet-choice modal, and the
extension injects a Pera row into it
(`apps/browser/src/content/connect-modal-row.ts`) only while the modal does not
carry `is-extension-enabled="true"`. The SDK sets that attribute on the dApp's
`experimental` constructor option alone, so a dApp passing `experimental: true`
sees the SDK's own "Install Pera Extension" prompt and not the extension's row,
until `@perawallet/connect` speaks `window.pera` and renders a working row
itself. Gating on `is-extension-available` instead would render both rows at
once.
