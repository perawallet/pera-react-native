# Pera Mobile App

This is the React Native application for Pera Wallet. It serves as the UI layer, consuming business logic from the workspace `packages/`.

## Prerequisites

- **Node.js**: >= 20
- **Package Manager**: pnpm 10+
- **iOS**: Mac with Xcode 15+, Ruby (Bundler), and CocoaPods.
- **Android**: Android Studio, Android SDKs, JDK 17.

## Setup

1.  **Install Dependencies** (Root):

    ```sh
    pnpm install
    ```

2.  **Install iOS Pods**:
    Note this may not be necessary in all cases. If you encounter build issues, try running this command:

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

- `src/App.tsx`: Application entry point.
- `src/components`: Reusable UI components (Buttons, Inputs, Cards).
- `src/modules`: Domain specific modules (e.g., `account`, `assets`, `contacts`, `settings`). Each modules can contain screens, components, hooks and more. A `Screen` is considered to be a navigable component.
- `src/routes`: React Navigation configuration.
- `src/hooks`: Custom React hooks (e.g., for navigation, animations).
    - _Note: Business logic hooks are imported from `packages/_`.\*
- `src/theme`: Theme definitions (Colors, Typography).
- `src/providers`: Global React Context providers (QueryClient, Theme, etc.).

## Configuration

### Firebase

This app uses React Native Firebase. You must provide your own configuration files for the app to build/run correctly if you are not using the repository defaults:

- iOS: `ios/GoogleService-Info.plist`
- Android: `android/app/google-services.json`

> **Note**: If you encounter build issues with Firebase on iOS, ensure your CocoaPods repo is up to date and you have a valid `GoogleService-Info.plist`.

## Development Notes

- **Path Aliases**: We use aliases like `@components/`, `@theme/`, etc. These are configured in `babel.config.js` and `tsconfig.json`.
- **State**: The app uses `TanStack Query` for server state and `Zustand` for client state (imported from packages).
- **Styling**: We use `react-native-elements` and `StyleSheet.create`.

## Troubleshooting

### "Phase Script Execution Failed" (iOS)

This often happens if Node is not found in the Xcode build phase. Ensure you opened Xcode via terminal or that your nvm/node setup is correct.

### Metro Connection Issues

Run `adb reverse tcp:8081 tcp:8081` for Android if the emulator cannot connect to the bundler.
