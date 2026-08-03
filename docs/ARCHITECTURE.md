# Architecture Overview

Pera Wallet is built as a **monorepo** with a clear separation between UI and business logic.

## The Big Picture

```
┌─────────────────────────────────────────────────────┐
│           apps/mobile  ·  apps/extension             │
│                     (UI Only)                        │
│                                                      │
│   Components → Screens → Navigation → User Facing    │
└────────────────────────┬────────────────────────────┘
                         │ imports
                         ▼
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
│              (Platform Adapters)                     │
│                                                      │
│   Storage → Keystore → Ledger → Device Info          │
└─────────────────────────────────────────────────────┘
```

The bottom layer is what lets the same packages run on React Native and in
Chrome: `extensions/platform` defines the contract, `platform-react-native`
and `platform-chrome` implement it, and packages reach it only through
`getProvider()`.

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
