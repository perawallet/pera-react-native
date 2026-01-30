# Pera Mobile App

The React Native application for Pera Wallet.

## Quick Start

```sh
# From apps/mobile directory
pnpm install
# Generate native folders (first time or after clean)
pnpm expo:prebuild
# Start dev server
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

### Native Project Issues (iOS/Android)
If you're having issues with native code or dependencies:

```sh
# Regenerate native folders
pnpm expo:prebuild

# For a completely fresh start
pnpm expo:prebuild:clean
```

### Metro Issues

```sh
pnpm start -- --reset-cache
```

## Learn More

- [Root README](../../README.md) - Setup and commands
- [Architecture](../../docs/ARCHITECTURE.md) - How the codebase is structured
- [Folder Structure](../../docs/FOLDER_STRUCTURE.md) - Where to put files
