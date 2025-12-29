# Architecture & State Management

## Overview

This project is a **monorepo** managed by [Turborepo](https://turbo.build/) and [pnpm](https://pnpm.io/). It separates the React Native User Interface from the core business logic to ensure better testability, reusability, and separation of concerns.

## Structure

### `apps/mobile` (UI Layer)

- Contains all **React Native** specific code (Components, Screens, Navigation).
- Responsible for **rendering** and **user interaction**.
- Should contain **minimal business logic**.
- Connects to the "Business Logic" (packages) via Hooks.
- Implements **platform integration** (e.g., Secure Storage, File System, Network).

### `packages` ("Headless" Business Logic Layer)

- **`shared`**: Common utilities, constants, types, and logging.
- **`platform-integration`**: Interfaces for platform specific features (Secure Storage, File System, Network).
- **`accounts`, `assets`, `contacts`, `settings`, `swaps`**: Domain-specific logic and state stores.
- **`kmd`**: KMD (Key Management Daemon) integration separate from accounts.
- **`blockchain`**: Algorand specific code and node/indexer interaction.
- **`walletconnect`**: WalletConnect v1 integration (v2 still pending)
- **`currencies`**: Currency formatting and preferences.
- **`config`**: Configuration and environment variables.
- **`devtools`**: Development tools and debugging utilities.
- **`polling`**: Polling logic for background tasks.
- **`xhdwallet`**: XHD (Extended HD) key derivation and signing logic (temp fork of @algorandfoundation/xhd-wallet-ts until react native is supported upstream).

## Separation of Concerns

1.  **UI is "Dumb"**: Components should receive data via Hooks and emit events. They should not know _how_ to fetch data or _how_ to process a transaction.
2.  **Logic is "Headless"**: Packages should generally be pure TypeScript/JavaScript (where possible) and testable without a simulator.
3.  **Platform Abstraction**: Use the `platform-integration` package to mock or access native device / platform-specific features.

## State Management

We use a hybrid approach:

### 1. Client State (Zustand)

Used for global, persistable app state that lives on the client (e.g., User Preferences, Theme, List of Accounts).

- **Stores** live inside `packages/` (e.g., `packages/settings/src/store`).
- **Do not export stores directly**. Expose **Hooks** (e.g., `useSettingsStore`) to the app.
- This encapsulates the implementation and allows for better optimized re-renders.

### 2. Server State (TanStack Query)

Used for asynchronous data from APIs (e.g., Account Balance, Asset Details, Transaction History).

- We make generated hooks (via Kubb) available for API interaction but these are only for reference (due to lack of quality openAPI specs).
- Wrap these query hooks in custom hooks within `packages/` if custom transformation is needed.
- **Caching** and **Background Refetching** are handled automatically.

## Data Flow

1.  **User** interacts with UI (`apps/mobile`).
2.  **UI** calls a Hook from a `package`.
3.  **Hook** interacts with a **Store** (Zustand) or **API** (React Query).
4.  **State/Data** updates and re-renders the UI.
