# Folder Structure

This guide helps you understand where different types of code belong and how they should be organized.

## Root Layout

```
pera-react-native/
├── apps/mobile/      # React Native app (UI)
├── packages/         # Business logic packages
├── tools/            # Build scripts and utilities
├── docs/             # Documentation (you are here)
└── specs/            # API specifications
```

## Mobile App Structure

```
apps/mobile/src/
├── components/       # Shared UI components (PW-prefixed)
├── modules/          # Feature modules (screens + components)
├── hooks/            # UI-specific hooks
├── providers/        # React context providers
├── routes/           # Navigation configuration
├── theme/            # Colors, typography, spacing
└── platform/         # Native platform implementations
```

## Component Folder Structure

**Every component and screen MUST follow this folder structure:**

```
ComponentName/              # PascalCase folder name
├── ComponentName.tsx       # Component file (same name as folder)
├── styles.ts               # Styles file at same level
├── index.ts                # Barrel file re-exporting the component
├── __tests__/              # Tests folder
│   └── ComponentName.spec.tsx  # Test file (same name + .spec.tsx)
└── SubComponent.tsx        # Subcomponents live here (NOT re-exported)
```

### Important Rules

1. **Component folders** use `PascalCase`: `PWButton/`, `AccountCard/`, `SettingsScreen/`
2. **All other folders** use `kebab-case`: `hooks/`, `providers/`, `utils/`
3. **Grouping folders** (non-component organizational folders) use `kebab-case`: `signing/`, `market/`, `holdings/`
4. **Barrel files** (`index.ts`) are required for all components
5. **Tests** go in a `__tests__/` subfolder using `.spec.tsx` extension

### Grouping Folders vs Component Folders

| Folder Type      | Naming       | Contains                           | Example                     |
| ---------------- | ------------ | ---------------------------------- | --------------------------- |
| Component folder | `PascalCase` | A single component with its files  | `PWButton/`, `AccountCard/` |
| Grouping folder  | `kebab-case` | Multiple related component folders | `signing/`, `market/`       |
| Utility folder   | `kebab-case` | Non-component code                 | `hooks/`, `utils/`          |

Example structure with grouping:

```
modules/transactions/components/
├── signing/                    # Grouping folder (kebab-case)
│   ├── BalanceImpactView/      # Component folder (PascalCase)
│   │   ├── BalanceImpactView.tsx
│   │   ├── styles.ts
│   │   └── index.ts
│   └── TransactionSigningView/ # Component folder (PascalCase)
│       ├── TransactionSigningView.tsx
│       ├── styles.ts
│       └── index.ts
└── TransactionIcon/            # Component folder (PascalCase)
    ├── TransactionIcon.tsx
    ├── styles.ts
    └── index.ts
```

## Packages Structure

Each package in `packages/` follows this pattern:

```
packages/accounts/src/
├── hooks/            # React hooks for this domain
├── store/            # Zustand store
├── models/           # TypeScript types
└── index.ts          # Public API exports
```

## Quick Reference: Where Do I Put...?

| What                            | Where                                                     |
| ------------------------------- | --------------------------------------------------------- |
| Reusable button, card, modal    | `apps/mobile/src/components/`                             |
| Account list screen             | `apps/mobile/src/modules/accounts/screens/AccountScreen/` |
| Component used only in accounts | `apps/mobile/src/modules/accounts/components/`            |
| Data fetching for accounts      | `packages/accounts/src/hooks/`                            |
| Account state management        | `packages/accounts/src/store/`                            |
| Toast or navigation hook        | `apps/mobile/src/hooks/`                                  |
| Secure storage implementation   | `apps/mobile/src/platform/`                               |
| Unit test                       | `__tests__/` folder next to the code                      |

## Learn More

- [Architecture](ARCHITECTURE.md) - The big picture
- [Naming Conventions](NAMING_CONVENTIONS.md) - How to name files and code
- For detailed patterns and examples, see `.agent/rules/component-patterns.md`
