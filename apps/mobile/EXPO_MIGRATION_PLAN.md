# Expo Migration Plan - Pera Wallet Mobile App

## Overview

This document outlines the step-by-step migration plan from bare React Native to Expo with Custom Development Builds (EAS Build).

**Migration Strategy**: Expo Prebuild with Config Plugins (Continuous Native Generation)
**Target SDK**: Expo SDK 53 (latest stable)
**React Native Version**: 0.83.0 (current) → Will use Expo's bundled RN version

---

## Phase 1: Foundation Setup

### 1.1 Install Expo Dependencies

Add core Expo packages:
```bash
pnpm add expo expo-dev-client expo-modules-core
pnpm add -D @expo/config-plugins
```

### 1.2 Create app.config.js

Replace `app.json` with a dynamic `app.config.js` that:
- Defines app name, slug, version
- Configures iOS and Android settings
- Sets up environment-specific configurations
- Includes all config plugins

### 1.3 Create eas.json

Define build profiles:
- `development` - For local development
- `preview` - For TestFlight/internal testing (staging)
- `production` - For App Store/Play Store release

### 1.4 Update babel.config.js

Switch to `babel-preset-expo` while preserving:
- Module resolver aliases
- Crypto polyfills
- Worklets plugin

### 1.5 Update metro.config.js

Wrap with Expo's Metro config while preserving:
- SVG transformer
- Workspace package resolution
- Polyfill mappings

---

## Phase 2: Package Replacements

### 2.1 Direct Replacements (Breaking Changes)

| Current | Expo Replacement | API Changes |
|---------|------------------|-------------|
| `react-native-bootsplash` | `expo-splash-screen` | Yes - different hide API |
| `react-native-localize` | `expo-localization` | Yes - different exports |
| `react-native-device-info` | `expo-device` + `expo-application` | Yes - split API |
| `react-native-linear-gradient` | `expo-linear-gradient` | Minor |
| `react-native-haptic-feedback` | `expo-haptics` | Yes |
| `@react-native-clipboard/clipboard` | `expo-clipboard` | Minor |
| `@react-native-community/netinfo` | `@react-native-community/netinfo` | Keep (has config plugin) |

### 2.2 Packages That Work With Config Plugins

These stay but need config plugins:
- `@react-native-firebase/*` - Has official Expo config
- `react-native-mmkv` - Has config plugin
- `lottie-react-native` - Has config plugin
- `react-native-keychain` - Has config plugin
- `react-native-vision-camera` - Has config plugin
- `@sbaiahmed1/react-native-biometrics` - Needs custom plugin
- `react-native-rate-app` - Needs custom plugin

### 2.3 High-Risk Native Packages

These need special attention:
- `react-native-quick-crypto` - Keep, create custom config plugin
- `react-native-webassembly` - Keep, create custom config plugin
- `react-native-nitro-modules` - Keep, verify compatibility
- `react-native-worklets` - Keep, verify compatibility
- `@notifee/react-native` - Keep, has Expo support via plugin

---

## Phase 3: Entry Point Migration

### 3.1 Update index.js

Change from:
```javascript
import { AppRegistry } from 'react-native'
AppRegistry.registerComponent(appName, () => App)
```

To:
```javascript
import { registerRootComponent } from 'expo'
registerRootComponent(App)
```

### 3.2 Update App.tsx

Replace `react-native-bootsplash` usage with `expo-splash-screen`:
```javascript
import * as SplashScreen from 'expo-splash-screen'
SplashScreen.preventAutoHideAsync()
// ... later
SplashScreen.hideAsync()
```

---

## Phase 4: Config Plugins

### 4.1 Built-in Plugins to Configure

- `expo-splash-screen` - Splash screen config
- `expo-build-properties` - Build settings (new arch, Hermes, etc.)

### 4.2 Third-Party Plugins

- `@react-native-firebase/app` - Firebase configuration
- `react-native-vision-camera` - Camera permissions
- `react-native-mmkv` - Storage
- `@notifee/react-native` - Notifications

### 4.3 Custom Plugins to Create

For packages without official plugins:
- `withQuickCrypto` - Configure quick-crypto native setup
- `withWebAssembly` - Configure WASM native setup
- `withBiometrics` - Configure biometric permissions
- `withDeepLinks` - Configure URL schemes and universal links
- `withBuildFlavors` - Configure environment-specific builds

---

## Phase 5: Native Project Generation

### 5.1 Run Prebuild

```bash
npx expo prebuild --clean
```

This generates fresh `ios/` and `android/` folders.

### 5.2 Preserve Required Files

Copy back:
- `ios/GoogleService-Info.plist`
- `android/app/google-services.json`
- Custom fonts (in assets)
- Signing configurations

### 5.3 Verify Native Projects

- iOS: Open Xcode, verify build settings
- Android: Open Android Studio, verify Gradle sync

---

## Phase 6: Build & CI/CD Migration

### 6.1 Create EAS Configuration

`eas.json` with profiles for:
- Local development builds
- Preview/staging builds
- Production builds

### 6.2 Update Scripts

Replace:
- `react-native run-ios` → `npx expo run:ios`
- `react-native run-android` → `npx expo run:android`
- `react-native start` → `npx expo start --dev-client`

### 6.3 Migrate Fastlane (Optional)

Either:
- Keep Fastlane for existing workflows
- Or migrate fully to EAS Build/Submit

---

## Phase 7: Testing & Verification

### 7.1 Build Verification

- [ ] `pnpm install` succeeds
- [ ] TypeScript compiles (`pnpm build`)
- [ ] Lint passes (`pnpm lint`)
- [ ] Tests pass (`pnpm test`)
- [ ] iOS builds (`expo run:ios`)
- [ ] Android builds (`expo run:android`)

### 7.2 Runtime Verification

- [ ] App launches without crash
- [ ] Splash screen works
- [ ] Navigation works
- [ ] All screens load
- [ ] Native modules function (crypto, camera, etc.)
- [ ] Firebase analytics/crashlytics work
- [ ] Push notifications work

---

## Migration Checklist

### Configuration Files
- [x] Create `app.config.js`
- [x] Create `eas.json`
- [x] Update `babel.config.js`
- [x] Update `metro.config.js`
- [x] Update `package.json`

### Code Changes
- [x] Update `index.js`
- [x] Update `App.tsx` (splash screen)
- [x] Replace `react-native-bootsplash` usage
- [x] Replace `react-native-localize` with `expo-localization`
- [x] Replace `react-native-device-info` with `expo-application` and `expo-device`
- [x] Replace `react-native-clipboard` with `expo-clipboard`
- [x] Remove unused native libraries

### Native
- [x] Run `expo prebuild`
- [x] Copy Firebase config files to `config/` directory
- [ ] Verify iOS builds
- [ ] Verify Android builds

### CI/CD
- [ ] Update build scripts
- [ ] Configure EAS (if using)
- [ ] Update Fastlane (if keeping)

---

## Environment Variables

Map current environment configs to EAS:

| Current | EAS Profile | Bundle ID (iOS) | Package (Android) |
|---------|-------------|-----------------|-------------------|
| Dev | development | com.algorandllc.perarn.staging | com.algorand.perarn.staging |
| Staging | preview | com.algorandllc.perarn.staging | com.algorand.perarn.staging |
| Production | production | com.algorandllc.perarn | com.algorand.perarn |

---

## Rollback Plan

If migration fails:
1. Revert to the pre-migration commit
2. Run `pnpm install` to restore node_modules
3. The original `ios/` and `android/` folders are preserved in git

---

## Timeline Estimate

- Phase 1 (Foundation): 2-4 hours
- Phase 2 (Packages): 4-6 hours
- Phase 3 (Entry Point): 1-2 hours
- Phase 4 (Config Plugins): 4-8 hours
- Phase 5 (Native Gen): 2-4 hours
- Phase 6 (CI/CD): 2-4 hours
- Phase 7 (Testing): 4-8 hours

**Total**: 19-36 hours of work
