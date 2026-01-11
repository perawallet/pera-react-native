# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Repository Overview

This is Pera Wallet, a React Native monorepo using pnpm workspaces and Turborepo. The architecture separates UI from business logic, with the mobile app in `apps/mobile` and headless business logic packages in `packages/*`.

## Essential Commands

### Setup and Installation

```sh
pnpm install
pnpm run setup  # Installs Git hooks (pre-commit, pre-push)

# iOS first-time setup
(cd apps/mobile/ios && bundle install && bundle exec pod install)
```

### Running the Mobile App

```sh
# Start Metro bundler (keep running)
pnpm --filter mobile start

# Run on platform (separate terminal)
pnpm --filter mobile ios
pnpm --filter mobile android

# Alternative from anywhere
pnpm -C apps/mobile start|ios|android
```

### Testing

```sh
# Run all tests with coverage
pnpm test

# Test specific package
pnpm --filter mobile test
pnpm --filter accounts test

# Watch mode
pnpm test --watch
```

### Code Quality

```sh
pnpm lint              # Check for linting errors
pnpm lint:fix          # Auto-fix linting errors
pnpm format            # Format code with Prettier
pnpm lint:copyright    # Add/update copyright headers
pnpm lint:i18n         # Check i18n errors
```

### Building

```sh
pnpm build  # Build all packages (Turborepo orchestrates dependencies)
```

### API Generation

```sh
pnpm run generate:all-apis  # Generate typed clients, zod schemas, msw mocks from OpenAPI specs
```

Note: Generated code (in `generated/`) is reference only - OpenAPI specs need improvement before direct use.

## Architecture

### Package Manager

Always use **pnpm** for this workspace. The repository uses pnpm workspaces with a catalog for version management.

### Core Principles

1. **Separation of Concerns**:
    - `apps/mobile`: React Native UI, screens, navigation, platform integrations
    - `packages/*`: Headless business logic, testable without a simulator

2. **State Management**:
    - **Client State**: Zustand stores in packages (e.g., `packages/settings/src/store`)
    - **Server State**: TanStack Query for API data with automatic caching/refetching
    - **Never export stores directly**: Always expose hooks (e.g., `useSettingsStore`)

3. **Data Flow**:
    - User interacts with UI → UI calls Hook → Hook interacts with Store/API → State updates → UI re-renders

### Key Packages

- **shared**: Common utilities, constants, types, logging
- **platform-integration**: Interfaces for secure storage, file system, network
- **accounts**: Account management and state
- **assets**: Asset tracking and management
- **blockchain**: Algorand-specific logic, node/indexer interaction
- **walletconnect**: WalletConnect v1 integration
- **kmd**: Key Management Daemon integration
- **contacts**: Contact management
- **settings**: User preferences and configuration
- **swaps**: Swap functionality
- **currencies**: Currency formatting and preferences
- **config**: Environment variables and configuration
- **polling**: Background polling logic
- **xhdwallet**: HD wallet key derivation (temp fork for React Native compatibility)
- **devtools**: ESLint configs, TypeScript configs, development utilities

### Mobile App Structure

- **components/**: Reusable UI components
- **modules/**: Feature-specific modules with their own components
- **layouts/**: Layout components and templates
- **routes/**: Navigation and routing configuration
- **hooks/**: Custom React hooks
- **platform/**: React Native platform implementations (SecureStorage, FileSystem, etc.)
- **providers/**: React context providers
- **theme/**: Theming and styling
- **i18n/**: Internationalization

## Development Guidelines

### Code Style

- TypeScript strict mode (never disable)
- No `any` - use `unknown` with type guards
- Explicit return types on exported functions
- Functional components with hooks (no class components)
- PascalCase for components/classes, camelCase for variables/functions, UPPER_CASE for constants
- Boolean props prefixed with `is`, `has`, `should`

### Security

- **Never** store private keys/mnemonics in plain text - always use `SecureStorageService` via `platform-integration`
- **Never** log sensitive data (private keys, mnemonics)
- Use custom `Logger` with sanitization for object logging
- Validate all user input and API responses
- Use Zod for schema validation where possible

### Testing

- Vitest for packages (headless logic)
- Jest for apps/mobile (React Native specifics)
- React Native Testing Library for component tests
- Colocate tests in `__tests__` directories
- Target ~90% coverage for packages
- Test behavior, not implementation details

### Git Workflow

- Branch naming: `<user-name>/<feature-or-fix>`
- Conventional Commits format
- PRs target `main` branch
- Use Squash Merge when merging

### Reusability Focus

Build reusable, scalable patterns and components early. Refactor for reusability to improve future development pace. Quality over quantity in documentation.

## Platform-Specific Notes

### iOS

- Requires Xcode 15+
- CocoaPods managed via Bundler (Ruby)
- Run `pod install` in `apps/mobile/ios` after dependency changes

### Android

- Requires Android Studio + SDKs
- JDK 17
- Emulator or physical device for testing

### macOS

- Install Watchman for fast reloads: `brew install watchman`

## Common Issues

### Dependency Management

- Dependencies are locked - be cautious updating to avoid supply chain attacks
- Run `pnpm audit` regularly
- The catalog in `pnpm-workspace.yaml` centralizes version management

### Git Hooks

- Pre-commit: Runs linting, formatting, copyright checks
- Pre-push: Runs tests
- Installed via `pnpm run setup`

### Metro Bundler

- Keep Metro running in separate terminal while developing
- Clear cache if issues: `pnpm --filter mobile start --reset-cache`
