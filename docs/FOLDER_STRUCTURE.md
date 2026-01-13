# Folder Structure Guide

This document provides a detailed breakdown of the project structure, explaining where to put different types of code and why.

## Root Directory

```
pera-react-native/
├── .agent/                  # AI agent configuration
├── .github/                 # GitHub workflows and templates
│   ├── workflows/           # CI/CD workflows
│   └── pull_request_template.md
├── apps/                    # Application packages
│   └── mobile/              # React Native mobile app
├── docs/                    # Project documentation
├── packages/                # Shared business logic packages
├── specs/                   # OpenAPI specifications
├── tools/                   # Development and build scripts
├── pnpm-workspace.yaml      # Workspace configuration
├── turbo.json               # Turborepo configuration
├── vitest.config.ts         # Root test configuration
└── package.json             # Root package with workspace scripts
```

---

## `apps/mobile/` Structure

The mobile app follows a feature-based architecture with clear separation of concerns.

```
apps/mobile/
├── android/                 # Android native code
├── ios/                     # iOS native code
├── assets/                  # Static assets (images, fonts, etc.)
├── src/                     # Application source code
│   ├── App.tsx              # Root application component
│   ├── bootstrap/           # App initialization logic
│   ├── components/          # Shared UI components
│   ├── constants/           # App-wide constants
│   ├── hooks/               # UI-specific hooks
│   ├── i18n/                # Internationalization
│   ├── layouts/             # Layout components
│   ├── modules/             # Feature modules
│   ├── platform/            # Platform-specific adapters
│   ├── providers/           # React Context providers
│   ├── routes/              # Navigation configuration
│   ├── test-utils/          # Test utilities and helpers
│   ├── theme/               # Theming (colors, typography)
│   └── types/               # App-wide type definitions
├── __mocks__/               # Jest mocks for native modules
├── babel.config.js          # Babel configuration
├── jest.config.js           # Jest configuration
├── jest.setup.ts            # Jest setup file
├── metro.config.js          # Metro bundler configuration
├── package.json             # App dependencies
└── tsconfig.json            # TypeScript configuration
```

### `src/components/` — Shared UI Components

Reusable components used across multiple modules. Each component has its own folder.

```
src/components/
├── button/
│   ├── PWButton.tsx          # Component implementation
│   └── styles.ts             # Component styles
├── badge/
│   ├── PWBadge.tsx
│   └── styles.ts
├── loading/
│   ├── PWLoading.tsx
│   └── styles.ts
└── [component-name]/
    ├── [ComponentName].tsx   # Main component file
    ├── styles.ts             # StyleSheet definitions
    └── __tests__/            # Optional component tests
        └── [ComponentName].test.tsx
```

**Rules:**

- Component folders use `kebab-case`
- Component files use `PascalCase`
- All components are prefixed with `PW` (Pera Wallet)
- Styles are in a separate `styles.ts` file

### `src/modules/` — Feature Modules

Domain-specific features containing screens, components, and hooks.

```
src/modules/
├── accounts/
│   ├── components/           # Module-specific components
│   │   ├── AccountCard/
│   │   │   ├── AccountCard.tsx
│   │   │   └── styles.ts
│   │   └── AccountList/
│   ├── screens/              # Navigable screens
│   │   ├── AccountsScreen.tsx
│   │   └── AccountsScreen.styles.ts
│   ├── hooks/                # Module-specific hooks (optional)
│   └── routes/               # Navigation configuration
├── settings/
│   ├── components/
│   │   └── app-version/
│   ├── screens/
│   │   ├── SettingsScreen.tsx
│   │   ├── SettingsScreen.styles.ts
│   │   ├── currency/         # Sub-feature screens
│   │   ├── developer/
│   │   └── theme/
│   └── hooks/
│       ├── delete-all-data.ts
│       └── settings-options.ts
└── [module-name]/
    ├── components/
    ├── screens/
    ├── hooks/
    └── routes/
```

**Rules:**

- Modules contain self-contained features
- Screens are top-level navigable components
- Components are reusable within the module
- Related sub-screens can be nested in folders

### `src/hooks/` — UI-Specific Hooks

Hooks for UI concerns (not business logic):

```
src/hooks/
├── __tests__/
│   └── clipboard.test.ts
├── async-action.ts          # Async operation handling
├── clipboard.ts             # Clipboard access
├── deeplink.ts              # Deep link handling
├── language.ts              # Language/locale
├── modal-state.ts           # Modal state management
├── theme.ts                 # Theme access
├── toast.ts                 # Toast notifications
└── webview.ts               # WebView utilities
```

**Note:** Business logic hooks belong in `packages/`, not here.

### `src/test-utils/` — Test Utilities

Shared testing utilities and mocks:

```
src/test-utils/
├── index.ts                 # Public exports
├── render.tsx               # Custom render with providers
├── mocks.ts                 # Common mocks
└── test-data.ts             # Test fixtures
```

---

## `packages/` Structure

Each package is a self-contained TypeScript library.

```
packages/
├── accounts/                # Account management
├── assets/                  # Asset management
├── blockchain/              # Algorand integration
├── config/                  # Configuration
├── contacts/                # Contacts
├── currencies/              # Currency handling
├── devtools/                # Developer tooling
│   ├── eslint/              # Shared ESLint config
│   └── tsconfig/            # Shared TypeScript configs
├── kmd/                     # Key Management Daemon
├── platform-integration/    # Platform abstraction
├── polling/                 # Background polling
├── settings/                # Settings
├── shared/                  # Common utilities
├── swaps/                   # Token swaps
├── walletconnect/           # WalletConnect
└── xhdwallet/               # HD wallet cryptography
```

### Package Internal Structure

```
packages/[domain]/
├── src/
│   ├── __tests__/           # Package-level tests
│   │   └── utils.test.ts
│   ├── hooks/               # React hooks
│   │   ├── __tests__/       # Hook tests
│   │   │   └── useXxx.test.ts
│   │   ├── index.ts         # Public hook exports
│   │   ├── querykeys.ts     # React Query keys
│   │   ├── endpoints.ts     # API endpoints
│   │   ├── useXxxQuery.ts   # Query hooks
│   │   └── useXxxMutation.ts # Mutation hooks
│   ├── models/              # Type definitions
│   │   ├── index.ts
│   │   └── types.ts
│   ├── store/               # Zustand store (optional)
│   │   ├── __tests__/
│   │   ├── index.ts
│   │   └── store.ts
│   ├── schema/              # Zod schemas (optional)
│   ├── index.ts             # Package public API
│   ├── constants.ts         # Package constants
│   ├── errors.ts            # Error definitions
│   └── utils.ts             # Utility functions
├── eslint.config.js
├── package.json
├── tsconfig.json
├── vite.config.ts
└── vitest.config.ts
```

---

## `tools/` Structure

Development and CI scripts:

```
tools/
├── setup.sh                 # Project setup script
├── pre-push                 # Pre-push Git hook
├── commit-msg               # Commit message hook
├── copyright.js             # Copyright header template
├── i18n-lint.cjs            # i18n validation
└── replace-imports.cjs      # Import replacement utility
```

---

## Where to Put What

| Type of Code                      | Location                                       | Example                      |
| --------------------------------- | ---------------------------------------------- | ---------------------------- |
| React Native screens              | `apps/mobile/src/modules/[module]/screens/`    | `SettingsScreen.tsx`         |
| Shared UI components              | `apps/mobile/src/components/[name]/`           | `PWButton.tsx`               |
| Module-specific components        | `apps/mobile/src/modules/[module]/components/` | `AccountCard.tsx`            |
| UI hooks (navigation, animations) | `apps/mobile/src/hooks/`                       | `useToast.ts`                |
| Business logic hooks              | `packages/[domain]/src/hooks/`                 | `useAccountBalancesQuery.ts` |
| Zustand stores                    | `packages/[domain]/src/store/`                 | `store.ts`                   |
| Type definitions (business)       | `packages/[domain]/src/models/`                | `types.ts`                   |
| Type definitions (UI)             | `apps/mobile/src/types/`                       | `navigation.d.ts`            |
| Utility functions (shared)        | `packages/shared/src/utils/`                   | `format.ts`                  |
| Constants (app-wide)              | `apps/mobile/src/constants/`                   | `ui.ts`                      |
| Platform abstractions             | `packages/platform-integration/src/`           | `storage.ts`                 |
| Test utilities (mobile)           | `apps/mobile/src/test-utils/`                  | `render.tsx`                 |
| CI scripts                        | `tools/`                                       | `pre-push`                   |
| Documentation                     | `docs/`                                        | `ARCHITECTURE.md`            |

---

## Anti-Patterns

### ❌ Wrong: Business logic in UI layer

```
apps/mobile/src/modules/accounts/hooks/useAccountBalance.ts
// This contains API calls and business logic
```

### ✅ Correct: Business logic in packages

```
packages/accounts/src/hooks/useAccountBalancesQuery.ts
// Business logic belongs in packages
```

---

### ❌ Wrong: Flat component directory

```
src/components/
├── Button.tsx
├── ButtonStyles.ts
├── Card.tsx
├── CardStyles.ts
```

### ✅ Correct: Component folders

```
src/components/
├── button/
│   ├── PWButton.tsx
│   └── styles.ts
├── card/
│   ├── PWCard.tsx
│   └── styles.ts
```

---

### ❌ Wrong: Importing store directly

```typescript
import { accountsStore } from '@perawallet/wallet-core-accounts'
// Direct store access breaks encapsulation
```

### ✅ Correct: Using hooks

```typescript
import { useAllAccounts } from '@perawallet/wallet-core-accounts'
// Hooks provide proper encapsulation
```
