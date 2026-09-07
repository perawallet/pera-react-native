# Code Layout

Where code goes and what to call it. `CLAUDE.md` holds the enforced rules and the component-location
table; this is the map and the worked examples.

## Directory trees

```
apps/mobile/src/
├── components/       # Shared UI components (PW-prefixed)
├── modules/          # Feature modules (screens + components)
├── hooks/            # UI-specific hooks
├── providers/        # React context providers
├── routes/           # Navigation configuration
├── theme/            # Colors, typography, spacing
├── i18n/             # Translations
└── platform/         # Platform helpers (implementations live in extensions/)
```

```
packages/<domain>/src/
├── hooks/            # React hooks for this domain
├── store/            # Zustand store
├── models/           # TypeScript types
├── db/               # Local queries (when the domain persists)
├── sync/             # Background sync (when the domain syncs)
├── msw-handlers.ts   # MSW factories, colocated with the endpoints they mock
├── test-handlers.ts  # Test-only barrel, never imported by prod code
└── index.ts          # Public API exports
```

The repo-root tree is in the [README](../README.md).

## File names

| Type             | Convention       | Example                               |
| ---------------- | ---------------- | ------------------------------------- |
| Component file   | `PascalCase.tsx` | `PWButton.tsx`, `AccountCard.tsx`     |
| Hook file        | `camelCase.ts`   | `useToast.ts`, `useAccountBalance.ts` |
| Utility file     | `kebab-case.ts`  | `string-utils.ts`                     |
| Style file       | `styles.ts`      | always this exact name                |
| Test file        | `*.spec.tsx`     | `PWButton.spec.tsx`                   |
| Component folder | `PascalCase`     | `PWButton/`, `SettingsScreen/`        |
| Grouping folder  | `kebab-case`     | `signing/`, `market/`, `hooks/`       |

A component folder holds one component and its files. A grouping folder holds several component
folders, or non-component code.

```
modules/transactions/components/
├── signing/                    # Grouping folder (kebab-case)
│   ├── BalanceImpactView/      # Component folder (PascalCase)
│   │   ├── BalanceImpactView.tsx
│   │   ├── styles.ts
│   │   ├── index.ts
│   │   └── __tests__/BalanceImpactView.spec.tsx
│   └── TransactionSigningView/
└── TransactionIcon/            # Component folder (PascalCase)
```

Subcomponents live beside their parent and are not re-exported from the barrel.

## Where do I put...?

| What                            | Where                                                                 |
| ------------------------------- | --------------------------------------------------------------------- |
| Reusable button, card, modal    | `apps/mobile/src/components/`                                         |
| Account list screen             | `apps/mobile/src/modules/accounts/screens/AccountScreen/`             |
| Component used only in accounts | `apps/mobile/src/modules/accounts/components/`                        |
| Domain-level hooks (shared)     | `apps/mobile/src/modules/[module]/hooks/`                             |
| Screen-specific hook            | Same folder as the screen (e.g., `AccountScreen/useAccountScreen.ts`) |
| Component-specific hook         | Same folder as the component (e.g., `AccountCard/useAccountCard.ts`)  |
| Data fetching hook (Query)      | `modules/[module]/hooks/use[Name]Query.ts`                            |
| Mutation hook                   | `modules/[module]/hooks/use[Name]Mutation.ts`                         |
| State management hook (Store)   | `modules/[module]/hooks/use[Name]Store.ts`                            |
| Toast or navigation hook        | `apps/mobile/src/hooks/`                                              |
| Secure storage implementation   | `extensions/platform-react-native/` (or `platform-chrome/`)           |
| Unit test                       | `__tests__/` folder next to the code                                  |

## Right and wrong

| Correct                       | Wrong                 | Why                                  |
| ----------------------------- | --------------------- | ------------------------------------ |
| `PWButton.tsx`                | `button.tsx`          | Component files are PascalCase       |
| `PWButton/`                   | `pw-button/`          | Component folders are PascalCase     |
| `AccountScreen/`              | `settings-screen/`    | Screen folders are PascalCase        |
| `useToast.ts`                 | `UseToast.ts`         | Hook files are camelCase             |
| `PWButton.spec.tsx`           | `PWButton.test.tsx`   | Tests use `.spec`                    |
| `useAccountsQuery.ts`         | `useAccounts.ts`      | Query hooks need the `Query` suffix  |
| `useCreateAccountMutation.ts` | `useCreateAccount.ts` | Mutations need the `Mutation` suffix |
| `useAccountsStore.ts`         | `useAccounts.ts`      | Stores need the `Store` suffix       |
| `isLoading`                   | `loading`             | Booleans take a prefix               |
| `signing/`                    | `Signing/`            | Grouping folders are kebab-case      |

The suffix is not decoration: it says which technology backs the hook, so a caller knows what it is
getting without opening the file.
