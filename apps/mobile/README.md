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

## Key Concepts

### Business Logic

All business logic lives in `packages/*`. Import from there, don't implement in the app:

```typescript
import { useAllAccounts } from '@perawallet/wallet-core-accounts'
```

### Shared Components

Use `PW` prefix for shared components in `src/components/`:

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

## Learn More

- [Root README](../../README.md) - Setup and commands
- [Architecture](../../docs/ARCHITECTURE.md) - How the codebase is structured
- [Folder Structure](../../docs/FOLDER_STRUCTURE.md) - Where to put files
