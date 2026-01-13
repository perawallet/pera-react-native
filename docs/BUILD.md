# Building Pera Wallet

Comprehensive guide for building Pera Wallet React Native app for iOS and Android across different environments (development, staging, production).

## Table of Contents

- [Overview](#overview)
- [Prerequisites](#prerequisites)
- [Quick Start](#quick-start)
- [Environment Configuration](#environment-configuration)
- [Building for iOS](#building-for-ios)
- [Building for Android](#building-for-android)
- [Open Source Builds](#open-source-builds)
- [Official Builds](#official-builds)
- [Troubleshooting](#troubleshooting)
- [Additional Resources](#additional-resources)

## Overview

Pera Wallet supports three build environments:

| Environment     | Description                     | Bundle ID (iOS)             | App ID (Android)            |
| --------------- | ------------------------------- | --------------------------- | --------------------------- |
| **Development** | Local development, debug builds | `com.algorand.perarn.dev`     | `com.algorand.perarn.dev`     |
| **Staging**     | Pre-production testing          | `com.algorand.perarn.staging` | `com.algorand.perarn.staging` |
| **Production**  | Official app store releases     | `com.algorand.perarn`         | `com.algorand.perarn`         |

Each environment can have different:

- Backend API URLs
- API keys
- Firebase configurations
- Feature flags
- App names and icons (can install side-by-side)

## Prerequisites

### Required for All Builds

- **Node.js**: >= 20.x (specified in package.json)
- **pnpm**: 10.15+ (see packageManager in package.json)
- **Git**: Latest version
- **Ruby**: 2.7+ (for CocoaPods and Fastlane)

Install dependencies:

```bash
pnpm install
pnpm run setup  # Installs git hooks
```

### iOS Additional Requirements

- **macOS**: macOS 12+ (Monterey or later)
- **Xcode**: 15.0+
- **CocoaPods**: Installed via Bundler
- **Apple Developer Account**: For device builds and distribution

Setup iOS:

```bash
cd apps/mobile/ios
bundle install
bundle exec pod install
```

### Android Additional Requirements

- **JDK**: 17
- **Android Studio**: Latest version
- **Android SDK**: API 34+
- **Android NDK**: Version specified in android/build.gradle

Environment variables (add to ~/.zshrc or ~/.bashrc):

```bash
export ANDROID_HOME=$HOME/Library/Android/sdk
export PATH=$PATH:$ANDROID_HOME/emulator
export PATH=$PATH:$ANDROID_HOME/platform-tools
export JAVA_HOME=$(/usr/libexec/java_home -v 17)
```

## Quick Start

### Development Builds (No Configuration Needed)

**iOS:**

```bash
# From root
pnpm --filter mobile ios

# Or from apps/mobile
pnpm ios
```

**Android:**

```bash
# From root
pnpm --filter mobile android

# Or from apps/mobile
pnpm android
```

Development builds use safe defaults and don't require environment configuration.

## Environment Configuration

For **staging** and **production** builds, you need to configure environment variables.

### Step 1: Copy Environment Template

```bash
# For staging
cp fastlane/.env.default fastlane/.env.staging

# For production
cp fastlane/.env.default fastlane/.env.production
```

### Step 2: Fill in Values

Edit the `.env.staging` or `.env.production` file:

**Required Values:**

```bash
# Apple Developer (iOS only)
APPLE_ID=your-apple-id@example.com
APPLE_TEAM_ID=XXXXXXXXXX

# Fastlane Match (iOS code signing)
MATCH_GIT_URL=https://github.com/your-org/pera-wallet-certificates
MATCH_PASSWORD=your-secure-password

# Android Signing
ANDROID_KEYSTORE_FILE=../apps/mobile/android/app/release.keystore
ANDROID_KEYSTORE_PASSWORD=your-keystore-password
ANDROID_KEY_ALIAS=pera-wallet-release
ANDROID_KEY_PASSWORD=your-key-password

# Pera Backend Configuration
PERA_MAINNET_BACKEND_URL=https://mainnet.api.perawallet.app
PERA_TESTNET_BACKEND_URL=https://testnet.api.perawallet.app
PERA_BACKEND_API_KEY=your-backend-api-key
```

**Optional Values:**

```bash
# Custom Algorand nodes (defaults to public AlgoNode)
PERA_MAINNET_ALGOD_URL=
PERA_TESTNET_ALGOD_URL=
PERA_MAINNET_INDEXER_URL=
PERA_TESTNET_INDEXER_URL=

# Feature flags
PERA_DEBUG_ENABLED=false
PERA_PROFILING_ENABLED=false
PERA_POLLING_ENABLED=true
```

See `fastlane/.env.default` for complete documentation of all variables.

### Step 3: Firebase Configuration (Optional but Recommended)

Each environment needs its own Firebase project:

**iOS**: Add `GoogleService-Info.plist` to:

- Dev: `apps/mobile/ios/mobile/GoogleService-Info-Dev.plist`
- Staging: `apps/mobile/ios/mobile/GoogleService-Info-Staging.plist`
- Production: `apps/mobile/ios/mobile/GoogleService-Info.plist`

**Android**: Add `google-services.json` to:

- Dev: `apps/mobile/android/app/src/dev/google-services.json`
- Staging: `apps/mobile/android/app/src/staging/google-services.json`
- Production: `apps/mobile/android/app/src/production/google-services.json`

See READMEs in each directory for detailed instructions.

## Building for iOS

### Prerequisites

1. **Complete Xcode Setup**: Follow `apps/mobile/ios/XCODE_SETUP.md` to:
    - Add xcconfig files to Xcode
    - Create 3 schemes (Mobile-Dev, Mobile-Staging, Mobile-Production)
    - Link configurations to xcconfig files

2. **Setup Code Signing**: Follow `docs/MATCH_SETUP.md` to:
    - Create certificates repository
    - Generate certificates with Match
    - Configure provisioning profiles

### Build Commands

**Development (Debug):**

```bash
# Using React Native CLI
pnpm --filter mobile build:ios:dev

# Using Fastlane
pnpm --filter mobile fastlane:ios:dev

# Direct
cd apps/mobile/ios
xcodebuild -workspace mobile.xcworkspace -scheme Mobile-Dev -configuration Debug
```

**Staging (Release):**

```bash
# Using npm script (loads .env.staging)
pnpm --filter mobile build:ios:staging

# Using Fastlane directly
cd apps/mobile
bundle exec fastlane ios build_staging
```

**Production (Release):**

```bash
# Using npm script (loads .env.production)
pnpm --filter mobile build:ios:production

# Using Fastlane directly
cd apps/mobile
bundle exec fastlane ios build_production
```

### Output

Built .ipa files are located in:

```
build/ios/
├── Mobile-Dev.ipa
├── Mobile-Staging.ipa
└── Mobile-Production.ipa
```

### Deploy to TestFlight

```bash
cd apps/mobile
bundle exec fastlane ios deploy_testflight scheme:Mobile-Staging
bundle exec fastlane ios deploy_testflight scheme:Mobile-Production
```

## Building for Android

### Prerequisites

1. **Setup Release Keystore** (for staging/production):

    ```bash
    # Generate keystore
    keytool -genkeypair -v \
      -keystore apps/mobile/android/app/release.keystore \
      -alias pera-wallet-release \
      -keyalg RSA \
      -keysize 2048 \
      -validity 10000

    # Configure keystore.properties
    cp apps/mobile/android/keystore.properties.example \
       apps/mobile/android/keystore.properties
    # Edit keystore.properties with your values
    ```

2. **Review Android Setup**: See `apps/mobile/android/ANDROID_SETUP.md`

### Build Commands

**Development (Debug APK):**

```bash
# Using React Native CLI
pnpm --filter mobile build:android:dev

# Using Gradle directly
cd apps/mobile/android
./gradlew assembleDevDebug
```

**Staging (Release APK):**

```bash
# Using npm script (loads .env.staging)
pnpm --filter mobile build:android:staging

# Using Gradle directly
cd apps/mobile/android
./gradlew assembleStagingRelease
```

**Production (Release APK):**

```bash
# Using npm script (loads .env.production)
pnpm --filter mobile build:android:production

# Using Gradle directly
cd apps/mobile/android
./gradlew assembleProductionRelease
```

**Build AAB (App Bundle for Play Store):**

```bash
cd apps/mobile/android

# Staging
./gradlew bundleStagingRelease

# Production
./gradlew bundleProductionRelease
```

### Output

**APKs:**

```
apps/mobile/android/app/build/outputs/apk/
├── dev/debug/app-dev-debug.apk
├── staging/release/app-staging-release.apk
└── production/release/app-production-release.apk
```

**AABs (App Bundles):**

```
apps/mobile/android/app/build/outputs/bundle/
├── stagingRelease/app-staging-release.aab
└── productionRelease/app-production-release.aab
```

### Deploy to Play Store

```bash
cd apps/mobile
bundle exec fastlane android deploy_internal    # Internal testing track
bundle exec fastlane android deploy_production  # Production track
```

## Open Source Builds

For developers building from source without official credentials:

### What Works Out of the Box

- ✅ All development builds (iOS and Android)
- ✅ Algorand blockchain interaction (uses public AlgoNode)
- ✅ Core wallet functionality
- ✅ QR code scanning
- ✅ Transaction signing
- ✅ WalletConnect integration

### What Requires Configuration

- ⚠️ Pera backend features (Discover, Swaps, Staking, etc.) - Requires Pera backend API
- ⚠️ Firebase features (Analytics, Crashlytics, Remote Config) - Requires Firebase project
- ⚠️ Push notifications - Requires Firebase Cloud Messaging setup

### Steps for OSS Build

1. **Clone and install:**

    ```bash
    git clone https://github.com/perawallet/pera-wallet-mobile.git
    cd pera-wallet-mobile
    pnpm install
    ```

2. **iOS setup:**

    ```bash
    cd apps/mobile/ios
    bundle install
    bundle exec pod install
    # Follow XCODE_SETUP.md for scheme creation
    ```

3. **Build:**

    ```bash
    # iOS
    pnpm --filter mobile ios

    # Android
    pnpm --filter mobile android
    ```

4. **(Optional) Configure your own backend:**
    - Set up your own backend infrastructure
    - Create `.env.local` with your URLs:
        ```bash
        PERA_MAINNET_BACKEND_URL=https://your-backend.com
        PERA_TESTNET_BACKEND_URL=https://testnet.your-backend.com
        PERA_BACKEND_API_KEY=your-api-key
        ```

5. **(Optional) Configure Firebase:**
    - Create Firebase projects in Firebase Console
    - Add `google-services.json` (Android) and `GoogleService-Info.plist` (iOS)
    - See environment-specific directories for placement

## Official Builds

For Pera team members and CI/CD:

### Complete Setup Checklist

- [ ] All prerequisites installed
- [ ] Xcode schemes created (iOS)
- [ ] Fastlane Match setup complete (iOS code signing)
- [ ] Android release keystore generated and configured
- [ ] `.env.staging` created and filled
- [ ] `.env.production` created and filled
- [ ] Firebase configurations added for all environments
- [ ] Test builds successful for all platforms/environments

### CI/CD Integration

See `.github/workflows/build-staging.yml` and `build-production.yml` for GitHub Actions setup.

Required GitHub Secrets:

- `MATCH_PASSWORD`
- `MATCH_GIT_URL`
- `APPLE_ID`
- `APPLE_TEAM_ID`
- `ANDROID_KEYSTORE_FILE` (base64 encoded)
- `ANDROID_KEYSTORE_PASSWORD`
- `ANDROID_KEY_ALIAS`
- `ANDROID_KEY_PASSWORD`
- `PERA_MAINNET_BACKEND_URL`
- `PERA_TESTNET_BACKEND_URL`
- `PERA_BACKEND_API_KEY`

## Troubleshooting

### iOS Build Errors

**"Code signing error: No certificate for team"**

- Run: `cd apps/mobile && bundle exec fastlane match appstore`
- Verify `MATCH_PASSWORD` and `MATCH_GIT_URL` are set

**"Scheme 'Mobile-Staging' not found"**

- Complete Xcode setup: `apps/mobile/ios/XCODE_SETUP.md`
- Ensure schemes are marked as **Shared** in Xcode

**"Could not find GoogleService-Info.plist"**

- Add Firebase config to appropriate location
- Or disable Firebase features if not needed

### Android Build Errors

**"Keystore not found"**

- Generate release keystore: See Android section above
- For dev builds, use debug keystore (automatically available)

**"google-services.json not found"**

- Add Firebase config to flavor-specific directory
- See `apps/mobile/android/app/src/{flavor}/README.md`

**"Execution failed for task ':app:processDevDebugGoogleServices'"**

- Package name in google-services.json doesn't match applicationId
- Download correct config from Firebase Console for specific app ID

### Environment Variable Issues

**"Required environment variable missing"**

- Ensure `.env.staging` or `.env.production` exists
- Verify all required variables are filled in
- Check for typos in variable names (they're case-sensitive)

**"Backend API authentication failed"**

- Verify `PERA_BACKEND_API_KEY` is correct
- Check that backend URLs are accessible
- Confirm API key has necessary permissions

### Build Performance

**Slow builds:**

- Use `--configuration Debug` for faster local testing
- Enable Xcode build caching: `defaults write com.apple.dt.XCBuild EnableSwiftBuildSystemIntegration -bool YES`
- Clean build folders periodically: `xcodebuild clean` or `./gradlew clean`

## Additional Resources

### Documentation

- [Architecture Guide](ARCHITECTURE.md) - System architecture and state management
- [Testing Guide](TESTING.md) - Writing and running tests
- [Style Guide](STYLE_GUIDE.md) - Code conventions
- [Security Guide](SECURITY.md) - Security best practices
- [Performance Guide](PERFORMANCE.md) - Performance optimization

### Platform-Specific

- [iOS Xcode Setup](../apps/mobile/ios/XCODE_SETUP.md)
- [Android Setup](../apps/mobile/android/ANDROID_SETUP.md)
- [Fastlane README](../fastlane/README.md)
- [Match Setup](MATCH_SETUP.md)

### Configuration

- [Config Package README](../packages/config/README.md) - Configuration system
- [Environment Variables](../fastlane/.env.default) - All available variables

### Monorepo

- [Main README](../README.md) - Project overview
- [Contributing Guide](../CONTRIBUTING.md) - Contribution guidelines

## Quick Reference

### Common Commands

```bash
# Install dependencies
pnpm install

# iOS development build
pnpm --filter mobile ios

# Android development build
pnpm --filter mobile android

# iOS staging build
pnpm --filter mobile build:ios:staging

# Android production build
pnpm --filter mobile build:android:production

# Run tests
pnpm test

# Lint code
pnpm lint

# Format code
pnpm format
```

### File Locations

- **Environment configs**: `fastlane/.env.{environment}`
- **iOS xcconfigs**: `apps/mobile/ios/Config/*.xcconfig`
- **Android gradle**: `apps/mobile/android/app/build.gradle`
- **Fastlane lanes**: `fastlane/Fastfile`
- **Build outputs**: `build/` (iOS) and `apps/mobile/android/app/build/outputs/` (Android)

## Support

For issues or questions:

- Check troubleshooting section above
- Review relevant documentation
- Open an issue on GitHub
- Contact the Pera development team

---

Happy building! 🚀
