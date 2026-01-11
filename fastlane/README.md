# Pera Wallet Fastlane Configuration

This directory contains Fastlane configuration for automating iOS and Android builds, code signing, and deployments.

## Overview

Fastlane is used to:
- Build iOS and Android apps for different environments (dev, staging, production)
- Manage code signing certificates and provisioning profiles (via Match)
- Deploy builds to TestFlight and Play Store
- Increment version numbers and build numbers

## Prerequisites

1. **Ruby & Bundler**: Install Ruby and Bundler (comes with macOS)
2. **Fastlane**: Installed via Gemfile
3. **iOS**: Xcode 15+ and valid Apple Developer account
4. **Android**: Android SDK and Java 17

## Installation

```bash
# From the apps/mobile directory
cd apps/mobile
bundle install
```

## Environment Configuration

### Development Builds (No Configuration Needed)

Development builds use default configurations and don't require environment variables.

### Staging/Production Builds

1. Copy the environment template:

    ```bash
    cp fastlane/.env.default fastlane/.env.staging
    # or
    cp fastlane/.env.default fastlane/.env.production
    ```

2. Edit the file and fill in real values:

    ```bash
    # Required for iOS
    APPLE_ID=your-apple-id@example.com
    APPLE_TEAM_ID=YOUR_TEAM_ID
    MATCH_GIT_URL=git@github.com:your-org/certificates.git
    MATCH_PASSWORD=your-secure-password

    # Required for Android
    ANDROID_KEYSTORE_FILE=../path/to/release.keystore
    ANDROID_KEYSTORE_PASSWORD=your-keystore-password
    ANDROID_KEY_ALIAS=pera-wallet-release
    ANDROID_KEY_PASSWORD=your-key-password

    # Required for Pera backend
    PERA_MAINNET_BACKEND_URL=https://mainnet.api.perawallet.app
    PERA_TESTNET_BACKEND_URL=https://testnet.api.perawallet.app
    PERA_BACKEND_API_KEY=your-api-key
    ```

3. **Important**: Never commit `.env.staging` or `.env.production` files!

## Available Lanes

### iOS Lanes

```bash
# Development build (Debug)
bundle exec fastlane ios build_dev

# Staging build (Release, AdHoc)
bundle exec fastlane ios build_staging

# Production build (Release, AppStore)
bundle exec fastlane ios build_production

# Deploy to TestFlight (staging)
bundle exec fastlane ios deploy_testflight

# Deploy to TestFlight (production)
bundle exec fastlane ios deploy_testflight scheme:Mobile-Production

# Code signing setup
bundle exec fastlane ios setup_match

# Version management
bundle exec fastlane ios bump_build        # Increment build number
bundle exec fastlane ios bump_version      # Increment version (patch)
bundle exec fastlane ios bump_version bump_type:minor  # Minor version
bundle exec fastlane ios bump_version bump_type:major  # Major version
```

### Android Lanes

```bash
# Development build (Debug)
bundle exec fastlane android build_dev

# Staging build (Release)
bundle exec fastlane android build_staging

# Production build (Release)
bundle exec fastlane android build_production

# Deploy to Play Store Internal Track
bundle exec fastlane android deploy_internal

# Deploy to Play Store Production
bundle exec fastlane android deploy_production

# Version management
bundle exec fastlane android bump_version_code  # Increment version code
bundle exec fastlane android bump_version_name  # Increment version name
```

## Code Signing with Match

Match syncs code signing certificates and provisioning profiles across your team using a git repository.

### Initial Setup

1. Create a private git repository for certificates:

    ```bash
    gh repo create pera-wallet-certificates --private
    ```

2. Initialize Match:

    ```bash
    cd apps/mobile
    bundle exec fastlane match init
    ```

3. Generate certificates for all bundle IDs:

    ```bash
    # Development certificates
    bundle exec fastlane match development

    # Distribution certificates (for TestFlight/App Store)
    bundle exec fastlane match appstore
    ```

4. Set the `MATCH_PASSWORD` in your environment files.

### Using Match in CI

In CI environments, use readonly mode to prevent creating new certificates:

```bash
MATCH_READONLY=true bundle exec fastlane ios setup_match
```

## Build from Package Scripts

You can also use the convenience scripts defined in `apps/mobile/package.json`:

```bash
# iOS
pnpm --filter mobile build:ios:dev
pnpm --filter mobile build:ios:staging
pnpm --filter mobile build:ios:production

# Android
pnpm --filter mobile build:android:dev
pnpm --filter mobile build:android:staging
pnpm --filter mobile build:android:production
```

## Output Artifacts

Built artifacts are saved to:
- **iOS**: `./build/ios/*.ipa`
- **Android**: `apps/mobile/android/app/build/outputs/bundle/`

## Troubleshooting

### iOS: Code Signing Issues

- Ensure you have the correct Apple Developer account credentials
- Run `bundle exec fastlane match appstore` to sync certificates
- Check that bundle IDs in Xcode match those in `.env.*` files
- Verify your Apple Team ID is correct

### Android: Keystore Issues

- Ensure the keystore file exists at the specified path
- Verify the keystore password and key alias are correct
- For first-time builds, you may need to generate a keystore:
    ```bash
    keytool -genkey -v -keystore release.keystore -alias pera-wallet-release \
      -keyalg RSA -keysize 2048 -validity 10000
    ```

### Environment Variables Not Loading

- Fastlane loads `.env.default` first, then overlays `.env.staging` or `.env.production`
- Check that you're in the correct directory when running Fastlane
- Verify the env file name matches exactly (`.env.staging`, not `.env-staging`)

### Match: Certificate Repo Issues

- Ensure you have access to the certificates repository
- Verify `MATCH_GIT_URL` is correct and accessible
- Check that `MATCH_PASSWORD` is set correctly
- If locked out, contact the team admin to reset Match

## Security Best Practices

1. **Never commit** `.env.staging` or `.env.production` to git
2. Use **strong passwords** for Match and keystores
3. **Rotate keys** regularly
4. Store passwords in a **password manager**
5. Use **read-only Match** in CI environments
6. Limit access to the Match certificates repository
7. Use **2FA** on Apple Developer and Play Console accounts

## CI/CD Integration

For automated builds in GitHub Actions, see `.github/workflows/build-staging.yml` and `.github/workflows/build-production.yml`.

Required GitHub Secrets:
- `APPLE_ID`
- `APPLE_TEAM_ID`
- `MATCH_GIT_URL`
- `MATCH_PASSWORD`
- `ANDROID_KEYSTORE_FILE` (base64 encoded)
- `ANDROID_KEYSTORE_PASSWORD`
- `ANDROID_KEY_ALIAS`
- `ANDROID_KEY_PASSWORD`
- `PERA_MAINNET_BACKEND_URL`
- `PERA_TESTNET_BACKEND_URL`
- `PERA_BACKEND_API_KEY`

## Further Reading

- [Fastlane Documentation](https://docs.fastlane.tools/)
- [Match Documentation](https://docs.fastlane.tools/actions/match/)
- [Gym (iOS Build) Documentation](https://docs.fastlane.tools/actions/gym/)
- [Gradle (Android Build) Documentation](https://docs.fastlane.tools/actions/gradle/)
