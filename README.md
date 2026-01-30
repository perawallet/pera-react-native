# Pera Monorepo

A concise guide to structure, setup, and daily commands.

## Prerequisites

- Node.js >= 20 and pnpm 10.15+ (see packageManager in [`package.json`](package.json))
- iOS: Xcode 15+, CocoaPods via Bundler (Ruby), iOS Simulator
- Android: Android Studio + SDKs, JDK 17, emulator or device
- macOS: Watchman for fast reloads

## Install

```sh
pnpm install
# Set up Git hooks (pre-commit and pre-push)
pnpm run setup
# First time setup or to regenerate native projects
pnpm --filter mobile expo:prebuild
```

> **Note:** The `pnpm run setup` command installs Git hooks that automatically run linting, formatting, copyright checks before commits, and tests before pushes.

## Build the packages

```sh
pnpm build
```

This will build all packages in the monorepo and write out any generated configuration.

### 1. Start Metro
In one terminal start Metro:

```sh
pnpm mobile:start
```

### 2. Run on device / simulator
In another terminal run a platform target:

```sh
# iOS
pnpm ios

# Android
pnpm android
```

Tip: you can also run these from the app folder:

```sh
pnpm -C apps/mobile start|ios|android
```

### Clean Rebuilds
If you need to regenerate native projects from scratch:

```sh
pnpm -C apps/mobile expo:prebuild:clean
```

## Building packages

Workspace packages in `packages/*` are built to `dist/` folders. The Turbo configuration automatically builds packages before running the mobile app or tests, so **no manual build step is required** for most development.

> [!NOTE]
> During local development, the Metro bundler is configured to resolve packages directly from their `src/index.ts` files. This means you do not need to run a manual build to see your changes reflected in the app.

For active package development with hot-reloading:

```sh
# Watch mode - rebuilds packages on file changes (useful for editors/tests)
pnpm dev:packages
```

To manually build all packages:

```sh
pnpm build:packages
```

## Workspace layout

```
pera-react-native/
├── apps/
│   └── mobile/              # React Native app (UI layer)
├── packages/                # Headless business logic packages
│   ├── accounts/            # Account management and state
│   ├── assets/              # Asset management
│   ├── blockchain/          # Algorand-specific code (node/indexer)
│   ├── config/              # Configuration and environment
│   ├── contacts/            # Contact management
│   ├── currencies/          # Currency formatting and preferences
│   ├── devtools/            # Development tools
│   │   ├── eslint/          # Shared ESLint configuration
│   │   └── tsconfig/        # Shared TypeScript configuration
│   ├── kms/                 # Key Management System integration
│   ├── platform-integration/# Platform abstraction layer
│   ├── polling/             # Background polling logic
│   ├── settings/            # User settings and preferences
│   ├── shared/              # Common utilities, types, and models
│   ├── swaps/               # Token swap functionality
│   ├── walletconnect/       # WalletConnect integration
│   └── xhdwallet/           # HD wallet crypto helpers
├── tools/                   # Development and CI scripts
├── specs/                   # OpenAPI specifications
└── docs/                    # Project documentation
```

See workspace definition in [`pnpm-workspace.yaml`](pnpm-workspace.yaml).

## Tooling

- Task runner/cache: Turborepo (scripts in [`package.json`](package.json))
- Formatting: Prettier
- Linting: ESLint with shared config from [`packages/devtools/eslint`](packages/devtools/eslint)
- TypeScript project references via [`packages/devtools/tsconfig`](packages/devtools/tsconfig)

Generate all API clients (using Kubb):

```sh
pnpm run generate:all-apis
```

This writes typed clients, zod schemas, msw mocks, and React Query hooks. Note that our code does not directly use this generated code (yet) as the OpenAPI specs are not up to scratch, but the generated code can be used for reference or inspiration.

## Common commands (root)

```sh
pnpm build          # build all packages
pnpm build:packages # build only workspace packages
pnpm dev:packages   # watch mode for package development
pnpm test           # run tests with coverage
pnpm lint           # report linting errors
pnpm lint:fix       # fix linting errors
pnpm lint:copyright # add/update necessary copyright headers
pnpm lint:i18n      # report i18n errors
pnpm format         # format files
```

## Documentation

- [Architecture & State Management](docs/ARCHITECTURE.md)
- [Folder Structure Guide](docs/FOLDER_STRUCTURE.md)
- [Naming Conventions](docs/NAMING_CONVENTIONS.md)
- [Testing Guide](docs/TESTING.md)
- [Style Guide](docs/STYLE_GUIDE.md)
- [Security Best Practices](docs/SECURITY.md)
- [Performance Guidelines](docs/PERFORMANCE.md)
- [Contributing Guide](CONTRIBUTING.md)

For app-specific notes, see [`apps/mobile/README.md`](apps/mobile/README.md).
