# Architecture Overview

Pera Wallet is built as a **monorepo** with a clear separation between UI and business logic.

## The Big Picture

```
┌──────────────────────────┐   ┌──────────────────────────┐
│       apps/mobile        │   │       apps/browser       │
│  (React Native — UI)     │   │  (MV3 extension shell)   │
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

### A note on the two meanings of "extension"

These two directory names look related and are not:

| Path           | What it is                                                                                                                                                              |
| -------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `apps/browser` | The **browser extension** — manifest, service worker, content scripts, offscreen document, and the build that assembles them into a loadable zip.                       |
| `extensions/*` | **Platform extensions** (drivers/plugins) for the upstream `@algorandfoundation/wallet-provider`, whose own API uses the word "extension". Nothing to do with browsers. |

`extensions/` is why mobile-only packages like `wallet-extension-platform-react-native` and
`wallet-extension-ledger-react-native-usb` live there: they are platform _drivers_, not browser code.
The directory cannot be renamed — the upstream provider API uses the term, and the churn would reach
deep into the mobile app — so the disambiguation lives here instead. (`apps/extension` was renamed to
`apps/browser` in 2026-08 for exactly this reason.)

### How a driver gets selected

`extensions/platform` declares the `PlatformServices` interface. `extensions/platform-driver` is a
stub that throws if it is ever reached, and each app's bundler aliases it to a concrete driver:
`platform-chrome` on web, `platform-react-native` on native (see `apps/mobile/metro.config.js`).
Business logic in `packages/*` reaches the resolved services only through `getProvider()`
(`extensions/provider`), so it depends on the interface and never on a platform — which is what keeps
`chrome.*` out of `packages/` entirely.

Two platform concerns are swapped by **module identity** rather than through that interface, and are
easy to miss when tracing: the keystore (`@algorandfoundation/react-native-keystore` resolves to
`extensions/keystore-chrome` on web) and the Ledger transports (`.web.ts` twins in
`extensions/provider`).

### Where browser-specific code lives

- **`apps/browser/src/`** — everything that only exists because this is an extension: the service
  worker, content scripts, and the offscreen document's headless hosts.
- **`apps/mobile/src/**/*.web.tsx`** — behavioural twins of a _named native sibling_ (for example
  `PWBottomSheet.web.tsx`). These stay colocated deliberately: their correctness depends on tracking
  the file next to them, and colocation is what makes a drifting prop visible in review.
- **`apps/browser/web-shims/`** — same-shaped stand-ins for native-only modules, mapped in by Metro
  when `platform === 'web'`.

A guardrail (`pnpm lint:guardrails`) enforces the boundary in the direction that actually matters:
a file that is **not** `.web.*` may not import `platform-chrome` or `keystore-chrome`, because such a
file is reachable from the native bundle and would fail at runtime on the missing `chrome` global.

### Turning features off per platform

Neither platform hides a feature with scattered `Platform.OS` checks. `routeCapabilities`
(`apps/mobile/src/routes/capabilities.ts` and its `.web.ts` twin) is one typed object per platform,
consumed at ~22 call sites, and a test asserts the two maps declare the same keys so a new capability
cannot be added to one and forgotten in the other.

The rule for adding an entry: **the flag records a decision, the comment next to it records the
reason.** Anything off on web is off for one of three reasons, and the comment says which — a
permanent platform limit (no push notifications, no store review), a dependency that cannot build
for the web bundle (quantum accounts: the Emscripten Falcon-1024 signer does not parse under Metro's
web bundler), or an external blocker (the Discover tab: Discover's own `DISCOVER_V3` minimum-version
map has no `web` key, so the lookup is `undefined`, `compareVersions` throws mid-render and unmounts
the tab — our iframe and content-script bridge are verified working, and reporting a dishonest
client type to work around it would corrupt analytics and device registration).

Keeping the reason at the flag rather than in a separate document is deliberate: the next person to
consider flipping it is already reading that line.

## Core Principle: Separation of Concerns

### UI Layer (`apps/mobile`)

The mobile app handles **only** UI concerns:

- Rendering components and screens
- Navigation between screens
- Styling and theming
- User interactions and gestures
- Platform-specific implementations

### Logic Layer (`packages/*`)

All business logic lives in packages:

- Data fetching and caching
- State management (Zustand stores)
- Business rules and validation
- API integrations
- Cryptographic operations

## Why This Matters

1. **Testability** - Business logic can be tested without React Native
2. **Reusability** - Packages could power a web or desktop app
3. **Maintainability** - Clear boundaries make code easier to understand
4. **Team scaling** - Different teams can own different layers

## State Management

We use two patterns:

| Pattern            | Use Case          | Example                               |
| ------------------ | ----------------- | ------------------------------------- |
| **Zustand**        | Client-side state | User settings, wallet accounts        |
| **TanStack Query** | Server state      | Account balances, transaction history |

Persisted stores resolve their storage lazily through the platform provider —
`createJSONStorage(() => getProvider().keyValueStorage)` — so a store can be
imported before the host app has registered its platform implementation.

Note that any Zustand store state must include a resetState() method, so that it can be reset to its initial state when the app is reinitialized (see BaseStoreState for a type).

## Key Packages

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

## Learn More

- For file placement rules, see [Folder Structure](FOLDER_STRUCTURE.md)
- For naming rules, see [Naming Conventions](NAMING_CONVENTIONS.md)
