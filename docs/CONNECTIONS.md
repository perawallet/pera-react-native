# Connections

How a dApp session reaches the wallet, on native and in the browser extension, and the decisions
that shape the seam between them.

## The model

`extensions/connections` owns the persisted record: a `Connection` (`src/models.ts`) is a peer, the
accounts it may act for, a `kind`, timestamps and an optional `origin`. It never holds secret
material; a kind that needs one (WalletConnect v1's session key) stores it elsewhere and keeps a
`secretRef`. The store (`src/store.ts`) validates every record on read, because persisted rows can
be stale or half-migrated.

`packages/connections` owns the runtime. A `ConnectionHandler` (`src/handler.ts`) is one protocol
managing N connections; the `ConnectionRegistry` (`src/registry.ts`) owns the handlers, validates
every inbound payload before a subscriber can see it, and reconciles the store from each handler's
`restore()` on boot. Handlers emit protocol-neutral `WalletOperation`s (ARC-0001 groups, ARC-60 or
legacy sign-data); `src/signing-adapter.ts` is the single bridge from those into the signing
pipeline, so a new protocol needs a handler and nothing else.

`src/testing/handler-contract.ts` is the contract suite every handler runs against. An assertion a
legitimate handler cannot satisfy is an interface finding, not a reason to bend the handler.

## Client and host surfaces

`ConnectionRegistry` is split by type. `ConnectionRegistryClient` is what a UI context holds: pair,
abandon a pairing, describe a URI, list a connection's networks, disconnect, subscribe to proposals
and errors. The full `ConnectionRegistry` adds `register`, `initialize`, `teardown` and
`subscribeToMessages`, and only the composition root that owns handlers holds one.

The split exists for the browser extension. There the live handlers run in the offscreen document,
and the popup, expanded tab and approval window cannot hold an in-process registry. Those realms get
`createRemoteConnectionRegistry` (`extensions/platform-chrome/src/connections/remote-registry.ts`),
a `ConnectionRegistryClient` whose descriptors are answered locally by handler instances that are
constructed but never initialised, whose lifecycle calls are request/response messages to the
offscreen host, and whose proposals and errors are re-emitted from a broadcast. The host surface is
absent by type, so a UI hook cannot register or initialise a handler by mistake.

Inbound sign requests never reach a UI-realm registry. The offscreen host forwards each one to the
service worker, which opens the approval window; the window rebuilds an `InboundMessage` whose
`respond`/`reject` answer through the approval bridge and hands it to `enqueueInboundRequest`, the
same function the native signing adapter uses. Proxying only pair, disconnect and approve keeps the
promise semantics honest: a proxied `respond()` that had to reject on a failed delivery across a
message port is exactly what would have been lost.

The remote registry is served from its own package entry,
`@perawallet/wallet-extension-platform-chrome/remote-registry`, and is kept off the main barrel: it
is the one platform-chrome module with a runtime dependency on the connections package, whose barrel
reaches react-native, and the service worker imports the main barrel.

## Message scopes

Defined in `extensions/platform-chrome/src/connections/protocol.ts`; every listener is gated to
extension-origin senders because content scripts share `chrome.runtime.onMessage`.

| Scope                      | Direction                | Carries                                                                                                                                       |
| -------------------------- | ------------------------ | --------------------------------------------------------------------------------------------------------------------------------------------- |
| `pera-connections-control` | UI or SW to offscreen    | pair, abandon-pairing, disconnect(-all), reconnect-all, approve/reject-proposal, respond; request/response, retried while the host is booting |
| `pera-connections-request` | offscreen to SW          | connection-proposal, connection-request, connection-error; acked                                                                              |
| `pera-connections-event`   | offscreen to every realm | proposal summaries and errors with scope; fire-and-forget                                                                                     |
| `pera-wc-page-pair`        | content script to SW     | a page's pair request; the SW stamps the browser-verified `requesterOrigin`                                                                   |

Two ack meanings on the request scope: a proposal or request acks acceptance (the decision comes
back later on the control scope, so waiting for it would deadlock the host); an error notice acks
dismissal, which is what lets the host keep at most one notice open against a page that pairs on
the wrong network in a loop.

`chrome.runtime` messaging is JSON, so operations and results cross the wire through the codec in
`protocol.ts`: ARC-60's `authenticatorData` and every signature travel as base64.

`approve-proposal` carries caller-chosen accounts. The host intersects them with the wallet's own
addresses before approving, because any extension page can send on the control scope.

## Composition roots

- Native: `apps/mobile/src/modules/connections/providers/useConnectionsProvider.ts` creates the
  registry, registers the WalletConnect v1 handler, boots it through `bootConnections`
  (`packages/connections/src/boot.ts`), and mounts the proposal queue, error toasts and signing
  adapter.
- Extension offscreen: `apps/browser/src/offscreen/runOffscreenApp.ts` does the same boot and starts
  `connectionsHost.ts`, which holds pending proposals and requests while the service worker collects
  the user's decision.
- Extension UI: `useConnectionsProvider.web.ts` builds the remote client and mirrors the store into
  `useConnectionsStore`, re-listing when another extension context writes the storage key.
- Service worker: `apps/browser/src/background/connections.ts` routes approval requests to the
  window bridge and decisions back; `connect-modal-pair.ts` is the trust boundary for page-initiated
  pairs.

A handler added on web must be constructed in both `useConnectionsProvider.web.ts` (so URI claims
and `networksFor` are answered) and `runOffscreenApp.ts` (so it is live).

## Boot order

`bootConnections` runs the one safe order: keystore ready, legacy import, `initialize()`, mirror
hydration. The legacy importer reads the keystore synchronously and reports "absent" before
hydration, and a handler restored before the import has written its records reports zero sessions,
which reconciliation would then delete.

## WalletConnect v1 session keys

`packages/walletconnect/src/v1/handler.ts` takes a `WalletConnectV1SessionKeyStore`
(`src/v1/secrets.ts`). Native uses the keystore-backed store. The offscreen document has no vault
and must revive sockets before the user unlocks, so it uses the storage-backed store and the key sits in
plaintext key-value storage. The keystore store fixes at-rest exposure on native only; in memory the connector retains the key as a string for the
socket's lifetime either way.

`importLegacyConnections` (`src/migration/importLegacyConnections.ts`) takes the same store, deletes
the legacy blob only once every committed key reads back, and is crash-resumable. It keeps its own
set of imported ids: the blob outlives a partial pass, and the live store alone cannot tell a record
that was never imported from one the user has since disconnected.

## Origins

`Connection.origin` records where a pairing entered the wallet (`external-browser`, `in-app`, `qr`)
at approval time, from the option passed to `pair`. The success sheet and the post-sign hand-off key
off it; an in-app pairing shows no sheet because the dApp is directly behind it.
