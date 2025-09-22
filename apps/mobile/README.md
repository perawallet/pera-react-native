# Pera Mobile

Minimal RN quickstart for this monorepo.

## Prerequisites

- Node.js >= 20 and pnpm 10+
- iOS: Xcode 15+, Ruby bundler + CocoaPods
- Android: Android Studio + SDKs, JDK 17

## Install

```sh
pnpm install
# iOS first time / after native deps change
(cd apps/mobile/ios && bundle install && bundle exec pod install)
```

## Run

```sh
# iOS
pnpm --filter mobile ios
# Android
pnpm --filter mobile android
```

From the app folder:

```sh
pnpm -C apps/mobile start|ios|android
```

## Code structure

- App entry: [apps/mobile/src/App.tsx](apps/mobile/src/App.tsx)
- Shared logic via Core package: [packages/core/src/index.ts](packages/core/src/index.ts)
- src/screens - top level navigation destinations
- src/components - any UI elements/widgets/shared components. Note the RootComponent here which does some heavy lifting.
- src/layouts - top level layout components
- src/routes - the react navigation route structure
- src/platform - the react native implementation of the core package platform interfaces
- src/theme - the react native elements theme structure (and theme.d.ts for quality of life extensions)

Note that various core modules are resolved to react query specific implementations in babel/metro config

React Query is provided by [QueryProvider()](apps/mobile/src/providers/QueryProvider.tsx:25) using a shared [queryClient](apps/mobile/src/providers/QueryProvider.tsx:9).

## Path aliases

Keep Babel and TS paths in sync:

- [babel.config.js](apps/mobile/babel.config.js)
- [tsconfig.json](apps/mobile/tsconfig.json)

Aliases include @components/_, @providers/_, @routes/_, @screens/_, @assets/\*.

NOTE at time of writing this works in VS Code, but when deployed on the device these break (more babel/metro debugging required)

## Styling

We use the React Native Elements package for basic widgets and rely on the themed version for theming. Use makeStyles to generate stylesheets for fast access.

## Firebase

The project includes:

- [ios/GoogleService-Info.plist](apps/mobile/ios/GoogleService-Info.plist)
- [android/app/google-services.json](apps/mobile/android/app/google-services.json)

Replace these for your environment if needed.

## Scripts

```sh
pnpm --filter mobile lint
pnpm --filter mobile test
pnpm --filter mobile test:watch
```
