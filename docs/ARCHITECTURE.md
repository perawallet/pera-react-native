# Architecture & State Management

## Overview

This project is a **monorepo** managed by [Turborepo](https://turbo.build/) and [pnpm](https://pnpm.io/). It separates the React Native User Interface from the core business logic to ensure better testability, reusability, and separation of concerns.

## Core Principles

1. **UI is "Dumb"**: Components receive data via Hooks and emit events. They should not know _how_ to fetch data or _how_ to process a transaction.
2. **Logic is "Headless"**: Packages are pure TypeScript/JavaScript (where possible) and testable without a simulator.
3. **Platform Abstraction**: Use the `platform-integration` package to mock or access native device / platform-specific features.

## High-Level Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                        apps/mobile (UI)                         │
│   ┌─────────────┐  ┌─────────────┐  ┌─────────────────────────┐ │
│   │  Screens    │  │ Components  │  │     Navigation          │ │
│   └──────┬──────┘  └──────┬──────┘  └────────────┬────────────┘ │
│          │                │                       │              │
│          └────────────────┴───────────────────────┘              │
│                           │                                      │
│                    React Hooks (UI-specific)                     │
└───────────────────────────┼─────────────────────────────────────┘
                            │
                            ▼
┌─────────────────────────────────────────────────────────────────┐
│                      packages/* (Logic)                          │
│                                                                  │
│   ┌───────────┐ ┌───────────┐ ┌───────────┐ ┌───────────┐       │
│   │ accounts  │ │  assets   │ │ blockchain│ │  settings │ ...   │
│   └─────┬─────┘ └─────┬─────┘ └─────┬─────┘ └─────┬─────┘       │
│         │             │             │             │              │
│         └─────────────┴─────────────┴─────────────┘              │
│                           │                                      │
│   ┌─────────────────┐  ┌──┴──────────────────────────────┐      │
│   │  shared         │  │  platform-integration            │      │
│   │  (utils/types)  │  │  (storage, network, filesystem) │      │
│   └─────────────────┘  └─────────────────────────────────┘      │
└─────────────────────────────────────────────────────────────────┘
```

## Layer Responsibilities

### `apps/mobile` (UI Layer)

- Contains all **React Native** specific code (Components, Screens, Navigation).
- Responsible for **rendering** and **user interaction**.
- Should contain **minimal business logic**.
- Connects to "Business Logic" (packages) via Hooks.
- Implements **platform integration** adapters (e.g., Secure Storage, File System, Network).

**Key directories:**
| Directory | Purpose |
|-----------|---------|
| `src/components/` | Reusable UI components (buttons, inputs, cards) |
| `src/modules/` | Domain-specific modules (accounts, settings, etc.) |
| `src/hooks/` | UI-specific custom hooks |
| `src/routes/` | Navigation configuration |
| `src/providers/` | Global React Context providers |
| `src/theme/` | Theme definitions (colors, typography) |
| `src/platform/` | Platform-specific implementations |

### `packages` (Headless Business Logic Layer)

| Package                | Purpose                                                                          |
| ---------------------- | -------------------------------------------------------------------------------- |
| `shared`               | Common utilities, constants, types, logging, and error infrastructure            |
| `platform-integration` | Interfaces for platform-specific features (Secure Storage, File System, Network) |
| `accounts`             | Account management, creation, import, and state                                  |
| `assets`               | Asset management and queries                                                     |
| `contacts`             | Contact book management                                                          |
| `settings`             | User preferences and app settings                                                |
| `swaps`                | Token swap functionality                                                         |
| `kmd`                  | KMD (Key Management Daemon) integration (separate from accounts)                 |
| `blockchain`           | Algorand-specific code and node/indexer interaction                              |
| `walletconnect`        | WalletConnect integration                                                        |
| `currencies`           | Currency formatting and preferences                                              |
| `config`               | Configuration and environment variables                                          |
| `devtools`             | Development tools (ESLint config, TypeScript config)                             |
| `polling`              | Polling logic for background tasks                                               |
| `xhdwallet`            | XHD (Extended HD) key derivation and signing logic                               |

## State Management

We use a hybrid approach:

### 1. Client State (Zustand)

Used for global, persistable app state that lives on the client (e.g., User Preferences, Theme, List of Accounts).

- **Stores** live inside `packages/` (e.g., `packages/accounts/src/store`).
- **Do not export stores directly**. Expose **Hooks** (e.g., `useAllAccounts`) to the app.
- This encapsulates the implementation and allows for better optimized re-renders.

**Store Pattern:**

```typescript
// packages/[domain]/src/store/store.ts
import { create, type StoreApi, type UseBoundStore } from 'zustand'
import { persist, createJSONStorage } from 'zustand/middleware'

// 1. Create store factory (accepts storage service for testability)
export const createAccountsStore = (storage: KeyValueStorageService) =>
    create<AccountsState>()(
        persist(
            (set, get) => ({
                // State and actions...
            }),
            {
                name: 'accounts-store',
                storage: createJSONStorage(() => storage),
            },
        ),
    )

// 2. Lazy initialization for proper dependency injection
export const initAccountsStore = () => {
    const storage = useKeyValueStorageService()
    const realStore = createAccountsStore(storage)
    lazy.init(realStore)
}
```

**Consuming in UI:**

```typescript
// ✅ GOOD: Select only what you need (minimal re-renders)
const balance = useAccountStore(state => state.balance)

// ❌ BAD: Triggers re-render for ANY store change
const { balance } = useAccountStore()
```

### 2. Server State (TanStack Query)

Used for asynchronous data from APIs (e.g., Account Balance, Asset Details, Transaction History).

- Custom query hooks live in `packages/[domain]/src/hooks/`.
- **Caching** and **Background Refetching** are handled automatically.

**Query Hook Pattern:**

```typescript
// packages/accounts/src/hooks/useAccountBalancesQuery.ts
export const useAccountBalancesQuery = (address: string) => {
    return useQuery({
        queryKey: ['account-balances', address],
        queryFn: () => fetchAccountBalances(address),
        enabled: !!address,
    })
}
```

## Data Flow

```
1. User interacts with UI (apps/mobile)
       │
       ▼
2. UI calls a Hook from a package
       │
       ▼
3. Hook interacts with Store (Zustand) or API (React Query)
       │
       ▼
4. State/Data updates and re-renders the UI
```

## Module Organization in `apps/mobile`

Modules in `src/modules/` are domain-specific and self-contained:

```
src/modules/accounts/
├── components/     # Module-specific components
├── screens/        # Navigable screens
├── hooks/          # Module-specific hooks (if any)
└── routes/         # Navigation configuration
```

## Package Structure

Each package follows a consistent structure:

```
packages/[domain]/
├── src/
│   ├── __tests__/      # Unit tests
│   ├── hooks/          # React hooks
│   │   ├── __tests__/  # Hook tests
│   │   └── index.ts    # Public exports
│   ├── models/         # TypeScript types and interfaces
│   ├── store/          # Zustand store (if applicable)
│   │   ├── __tests__/  # Store tests
│   │   └── index.ts    # Public exports
│   ├── utils.ts        # Utility functions
│   └── index.ts        # Package public API
├── eslint.config.js
├── package.json
├── tsconfig.json
├── vite.config.ts
└── vitest.config.ts
```

## Cross-Package Dependencies

```
                     shared (types, utils, logging)
                           ▲
                           │
        ┌──────────────────┼──────────────────┐
        │                  │                  │
    accounts            assets           settings
        │                  │                  │
        └─────────────┬────┴──────────────────┘
                      │
              platform-integration
                      │
                      ▼
                 apps/mobile
```

**Rule:** Lower-level packages should never import from higher-level packages or from `apps/mobile`.
