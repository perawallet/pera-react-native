# Folder Structure

This guide helps you understand where different types of code belong.

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

| What                            | Where                                          |
| ------------------------------- | ---------------------------------------------- |
| Reusable button, card, modal    | `apps/mobile/src/components/`                  |
| Account list screen             | `apps/mobile/src/modules/accounts/screens/`    |
| Component used only in accounts | `apps/mobile/src/modules/accounts/components/` |
| Data fetching for accounts      | `packages/accounts/src/hooks/`                 |
| Account state management        | `packages/accounts/src/store/`                 |
| Toast or navigation hook        | `apps/mobile/src/hooks/`                       |
| Secure storage implementation   | `apps/mobile/src/platform/`                    |
| Unit test                       | `__tests__/` folder next to the code           |

## Naming Quick Reference

| Element          | Convention     | Example              |
| ---------------- | -------------- | -------------------- |
| Shared component | `PW` prefix    | `PWButton.tsx`       |
| Module component | PascalCase     | `AccountCard.tsx`    |
| Screen           | `[Name]Screen` | `AccountsScreen.tsx` |
| Hook file        | camelCase      | `useToast.ts`        |
| Style file       | `styles.ts`    | `styles.ts`          |
| Directory        | kebab-case     | `account-card/`      |

## Learn More

- [Architecture](ARCHITECTURE.md) - The big picture
- [Naming Conventions](NAMING_CONVENTIONS.md) - Detailed naming rules
