# Architecture

Pera Wallet is a monorepo that keeps UI and business logic in separate layers.

## The big picture

```
┌──────────────────────────┐   ┌──────────────────────────┐
│       apps/mobile        │   │       apps/browser       │
│  (React Native UI)       │   │  (MV3 extension shell)   │
│                          │   │                          │
│  Components → Screens →  │   │  manifest, service       │
│  Navigation → User       │   │  worker, content         │
│  Facing                  │   │  scripts, offscreen      │
└───────────┬──────────────┘   └───────────┬──────────────┘
            │                              │
            │  both import                 │
            ▼                              ▼
┌─────────────────────────────────────────────────────┐
│                    packages/*                        │
│           (Headless Business Logic)                  │
│                                                      │
│   Stores → Hooks → API Clients → Models              │
└────────────────────────┬────────────────────────────┘
                         │ getProvider()
                         ▼
┌─────────────────────────────────────────────────────┐
│                   extensions/*                       │
│      (Platform drivers behind one interface)         │
│                                                      │
│   platform (the contract) → platform-chrome /        │
│   platform-react-native (the implementations)        │
└─────────────────────────────────────────────────────┘
```

`apps/mobile` owns rendering, navigation, styling and gestures. `packages/*` owns everything else:
data fetching, stores, business rules, API clients, crypto. The split is what lets the logic be
tested without React Native, and what let the browser extension reuse it.

### Two meanings of "extension"

These two directory names look related and are not.

| Path           | What it is                                                                                                                                                          |
| -------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `apps/browser` | The browser extension: manifest, service worker, content scripts, offscreen document, and the build that assembles them into a loadable zip.                        |
| `extensions/*` | Platform extensions (drivers/plugins) for the upstream `@algorandfoundation/wallet-provider`, whose own API uses the word "extension". Nothing to do with browsers. |

That is why mobile-only packages like `wallet-extension-platform-react-native` and
`wallet-extension-ledger-react-native-usb` live under `extensions/`: they are platform _drivers_, not
browser code. The directory cannot be renamed, because the upstream provider API uses the term and
the churn would reach deep into the mobile app, so the disambiguation lives here instead.

### How a driver gets selected

`extensions/platform` declares the `PlatformServices` interface. `extensions/platform-driver` is a
stub that throws if it is ever reached, and each app's bundler aliases it to a concrete driver:
`platform-chrome` on web, `platform-react-native` on native (see `apps/mobile/metro.config.js`).
Business logic in `packages/*` reaches the resolved services only through `getProvider()`
(`extensions/provider`), so it depends on the interface and never on a platform. That is what keeps
`chrome.*` out of `packages/` entirely.

Two platform concerns are swapped by module identity rather than through that interface, and are easy
to miss when tracing: the vault surface (`@algorandfoundation/react-native-keystore` resolves to
`extensions/keystore-chrome` on web — but only for the password vault, auto-lock, passkey unlock and
the WebAuthn signer; the web account-keystore engine itself is composed from upstream
`@algorandfoundation/keystore-core` + `keystore-web` in `extensions/provider`'s `createKeystore.web.ts`)
and the Ledger transports (`.web.ts` twins in `extensions/provider`).

### Where browser-specific code lives

`apps/browser/src/` holds everything that only exists because this is an extension: the service
worker, content scripts, and the offscreen document's headless hosts.

`apps/mobile/src/**/*.web.tsx` holds behavioural twins of a _named native sibling_, for example
`PWBottomSheet.web.tsx`. These stay colocated deliberately: their correctness depends on tracking the
file next to them, and colocation is what makes a drifting prop visible in review.

`apps/browser/web-shims/` holds same-shaped stand-ins for native-only modules, mapped in by Metro
when `platform === 'web'`.

A guardrail (`pnpm lint:guardrails`) enforces the boundary in the direction that actually matters: a
file that is not `.web.*` may not import `platform-chrome` or `keystore-chrome`, because such a file
is reachable from the native bundle and would fail at runtime on the missing `chrome` global.

### Turning features off per platform

Neither platform hides a feature with scattered `Platform.OS` checks. `routeCapabilities`
(`apps/mobile/src/routes/capabilities.ts` and its `.web.ts` twin) is one typed object per platform,
read throughout the app, and a test asserts the two maps declare the same keys so a new capability
cannot be added to one and forgotten in the other.

The rule for adding an entry: the flag records a decision, the comment next to it records the reason.
Anything off on web is off for one of three reasons, and the comment says which.

- A permanent platform limit (no push notifications, no store review).
- A dependency that cannot build for the web bundle (quantum accounts: the Emscripten Falcon-1024
  signer does not parse under Metro's web bundler).
- An external blocker (the Discover tab: Discover's own `DISCOVER_V3` minimum-version map has no
  `web` key, so the lookup is `undefined`, `compareVersions` throws mid-render and unmounts the tab.
  Our iframe and content-script bridge are verified working, and reporting a dishonest client type to
  work around it would corrupt analytics and device registration).

Keeping the reason at the flag rather than in a separate document is deliberate: the next person to
consider flipping it is already reading that line.

## Networks without a Pera backend

Only MainNet and TestNet are Pera-backed (`PERA_BACKED_NETWORKS` in
`packages/config/src/network-config.ts`). On betanet and any custom node, every request declaring
`backend: 'pera'` throws `PeraServiceUnavailableError` in `packages/shared/src/api/query-client.ts`
before a socket opens, so the failure is structural and instant rather than a timeout.

Reads whose answer is obtainable from algod or the indexer must therefore branch on
`isPeraBackedNetwork(network)` and take the public path, rather than swallowing the error as an empty
result. Swallowing it is indistinguishable from a genuine empty result in the UI, which is how a
dead probe once reported "no addresses found" during account discovery. Pera-proprietary reads have
no fallback and should surface as unavailable.

## Account types share one signing path

Algo25, HD-wallet and quantum (Falcon-1024) accounts all route through
`useLocalKeyTransactionSigner` and `createLocalKeyStrategy`. `determineSignerType` has no
`'quantum'` case: a quantum account classifies as `'localKey'` like the others, because it satisfies
`hasSigningKeys`. The only quantum-specific step is that the signer asks
`useKMS().getPQSigningInfo(keyPairId)` once per call and, when that returns non-null, signs
`pqSigningDigest(txn)` and assembles via `assemblePQSignedTransaction`.

Worth knowing because the absence is invisible: if you go looking for a quantum branch in signing,
routing or submission, there isn't one, and adding one is a regression. The Falcon libraries are
confined to `packages/kms/src/crypto/pq` and a test fails CI if they appear anywhere else.

## State management

Zustand holds client state (user settings, wallet accounts). TanStack Query holds server state
(balances, transaction history).

Persisted stores resolve their storage lazily through the platform provider,
`createJSONStorage(() => getProvider().keyValueStorage)`, so a store can be imported before the host
app has registered its platform implementation.

Every store's state must include a `resetState()` method so it can be returned to its initial state
when the app reinitializes (see `BaseStoreState`).

## Key packages

| Package      | Purpose                            |
| ------------ | ---------------------------------- |
| `accounts`   | Wallet account management          |
| `assets`     | Asset information and pricing      |
| `blockchain` | Algorand node/indexer access       |
| `signing`    | Transaction signing and submission |
| `database`   | Local persistence                  |
| `settings`   | User preferences                   |
| `shared`     | Common utilities and models        |

Platform service abstractions live in `extensions/*`, not in a package.

## Learn more

- Where files go and what to call them: [Code Layout](CODE_LAYOUT.md)
