# Pera Mobile App

The React Native application for Pera Wallet.

## Quick Start

```sh
# From root directory
pnpm install
pnpm start

# Run on device/simulator
pnpm ios      # or: pnpm android
```

## Project Structure

```
src/
├── components/    # Shared UI components (PW-prefixed)
├── modules/       # Feature modules (accounts, settings, etc.)
├── hooks/         # UI-specific hooks
├── providers/     # React context providers
├── routes/        # Navigation
├── theme/         # Colors, typography
└── platform/      # Native implementations
```

## Key Concepts

### Modules

Features are organized into modules. Each has its own screens, components, and routes:

```
modules/accounts/
├── screens/        # AccountsScreen, etc.
├── components/     # AccountCard, etc.
└── routes/
```

### Business Logic

Import from `packages/*`, don't implement in the app:

```typescript
import { useAllAccounts } from '@perawallet/wallet-core-accounts'
```

### Shared Components

Use `PW` prefix for shared components:

```typescript
import PWButton from '@components/button/PWButton'
```

## Testing

```sh
pnpm test                   # All tests
pnpm test -- --watch        # Watch mode
```

## Troubleshooting

### CocoaPods Issues

```sh
cd ios && bundle exec pod install --clean-install
```

### Metro Issues

```sh
pnpm start -- --reset-cache
```

## Related Docs

- [Root README](../../README.md)
- [Architecture](../../docs/ARCHITECTURE.md)
