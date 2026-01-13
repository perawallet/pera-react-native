# Pera Mobile App

This is the React Native application for Pera Wallet. It serves as the UI layer, consuming business logic from the workspace `packages/`.

## Prerequisites

- **Node.js**: >= 20
- **Package Manager**: pnpm 10+
- **iOS**: Mac with Xcode 15+, Ruby (Bundler), and CocoaPods.
- **Android**: Android Studio, Android SDKs, JDK 17.

## Setup

1. **Install Dependencies** (Root):

    ```sh
    pnpm install
    ```

2. **Install iOS Pods** (if needed):

    ```sh
    cd ios && bundle install && bundle exec pod install
    ```

## Running the App

Start the Metro Bundler:

```sh
pnpm start
```

Run on Device/Simulator:

```sh
# iOS
pnpm ios

# Android
pnpm android
```

## Project Structure

```
src/
├── App.tsx              # Application entry point
├── bootstrap/           # App initialization logic
├── components/          # Shared UI components (PW-prefixed)
│   ├── button/
│   │   ├── PWButton.tsx
│   │   └── styles.ts
│   ├── loading/
│   ├── badge/
│   └── ...
├── constants/           # App-wide constants
├── hooks/               # UI-specific hooks
│   ├── toast.ts
│   ├── theme.ts
│   ├── clipboard.ts
│   └── ...
├── i18n/                # Internationalization
├── layouts/             # Layout components
├── modules/             # Feature modules
│   ├── accounts/
│   │   ├── components/  # Module-specific components
│   │   ├── screens/     # Navigable screens
│   │   └── routes/      # Navigation config
│   ├── settings/
│   ├── transactions/
│   └── ...
├── platform/            # Platform-specific implementations
├── providers/           # Global React Context providers
├── routes/              # Root navigation configuration
├── test-utils/          # Test utilities
├── theme/               # Theme (colors, typography)
└── types/               # App-wide type definitions
```

## Key Concepts

### Modules

Each module is a self-contained feature:

```
modules/accounts/
├── components/          # Module-specific components
│   ├── AccountCard/
│   └── AccountList/
├── screens/             # Navigable screens
│   ├── AccountsScreen.tsx
│   └── AccountsScreen.styles.ts
├── hooks/               # Module-specific hooks (optional)
└── routes/              # Navigation configuration
```

### Components

- **Shared components** live in `src/components/` and are prefixed with `PW` (Pera Wallet)
- **Module components** live in `src/modules/[module]/components/` without prefix
- All components have their styles in a separate `styles.ts` file

### Business Logic

Business logic is imported from `packages/*`, NOT implemented in the mobile app:

```typescript
// ✅ GOOD: Import from packages
import {
    useAllAccounts,
    useCreateAccount,
} from '@perawallet/wallet-core-accounts'

// ❌ BAD: Implement logic in app
const fetchAccounts = async () => {
    /* ... */
}
```

## Configuration

### Firebase

This app uses React Native Firebase. You must provide your own configuration files:

- iOS: `ios/GoogleService-Info.plist`
- Android: `android/app/google-services.json`

### Environment Variables

Create a `.env` file based on `.env.example` for local development.

### Path Aliases

Path aliases are configured in `babel.config.js` and `tsconfig.json`:

| Alias          | Path              |
| -------------- | ----------------- |
| `@/`           | `src/`            |
| `@components/` | `src/components/` |
| `@providers/`  | `src/providers/`  |
| `@routes/`     | `src/routes/`     |
| `@hooks/`      | `src/hooks/`      |
| `@constants/`  | `src/constants/`  |
| `@modules/`    | `src/modules/`    |
| `@layouts/`    | `src/layouts/`    |
| `@theme/`      | `src/theme/`      |
| `@assets/`     | `assets/`         |
| `@test-utils/` | `src/test-utils/` |

## Testing

Tests use Jest with React Native Testing Library:

```sh
pnpm test              # Run all tests
pnpm test -- --watch   # Watch mode
```

Test utilities are in `src/test-utils/`:

```typescript
import { render, fireEvent } from '@test-utils'
import PWButton from '@components/button/PWButton'

test('button works', () => {
    const { getByText } = render(<PWButton title="Click me" variant="primary" />)
    expect(getByText('Click me')).toBeTruthy()
})
```

## Troubleshooting

### "Phase Script Execution Failed" (iOS)

This often happens if Node is not found in the Xcode build phase. Ensure you opened Xcode via terminal or that your nvm/node setup is correct.

### Metro Connection Issues

Run `adb reverse tcp:8081 tcp:8081` for Android if the emulator cannot connect to the bundler.

### CocoaPods Issues

```sh
cd ios
bundle install
bundle exec pod repo update
bundle exec pod install --clean-install
```

### Clean Build

```sh
# iOS
cd ios && rm -rf Pods Podfile.lock build && bundle exec pod install

# Android
cd android && ./gradlew clean
```

## Related Documentation

- [Root README](../../README.md)
- [Architecture](../../docs/ARCHITECTURE.md)
- [Folder Structure](../../docs/FOLDER_STRUCTURE.md)
- [Naming Conventions](../../docs/NAMING_CONVENTIONS.md)
- [Testing Guide](../../docs/TESTING.md)
- [Style Guide](../../docs/STYLE_GUIDE.md)
