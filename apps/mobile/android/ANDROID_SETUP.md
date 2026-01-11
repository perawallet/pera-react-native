# Android Product Flavors Setup

This guide explains the Android product flavors configuration and how to build different environment variants.

## Overview

The Android app uses **product flavors** to support three environments:

- **dev** - Development environment (`com.algorand.android.perarn.dev`)
- **staging** - Staging environment (`com.algorand.android.perarn.staging`)
- **production** - Production environment (`com.algorand.android`)

Each flavor can be combined with build types (Debug/Release) to create build variants.

## Build Variants

The following build variants are available:

| Variant           | Flavor     | Build Type | App ID                              | App Name     | Use Case               |
| ----------------- | ---------- | ---------- | ----------------------------------- | ------------ | ---------------------- |
| devDebug          | dev        | Debug      | com.algorand.android.perarn.dev     | Pera Dev     | Local development      |
| devRelease        | dev        | Release    | com.algorand.android.perarn.dev     | Pera Dev     | Testing release builds |
| stagingDebug      | staging    | Debug      | com.algorand.android.perarn.staging | Pera Staging | Staging testing        |
| stagingRelease    | staging    | Release    | com.algorand.android.perarn.staging | Pera Staging | Staging deployment     |
| productionDebug   | production | Debug      | com.algorand.android.perarn         | Pera         | Production testing     |
| productionRelease | production | Release    | com.algorand.android.perarn         | Pera         | Production deployment  |

## Configuration

### Product Flavors (build.gradle)

The flavors are defined in `apps/mobile/android/app/build.gradle`:

```gradle
productFlavors {
    dev {
        dimension "environment"
        applicationId "com.algorand.android.perarn.dev"
        versionNameSuffix "-dev"
        resValue "string", "app_name", "Pera Dev"
        buildConfigField "String", "APP_ENV", '"development"'
    }

    staging {
        dimension "environment"
        applicationId "com.algorand.android.perarn.staging"
        versionNameSuffix "-staging"
        resValue "string", "app_name", "Pera Staging"
        buildConfigField "String", "APP_ENV", '"staging"'
    }

    production {
        dimension "environment"
        applicationId "com.algorand.android.perarn"
        resValue "string", "app_name", "Pera"
        buildConfigField "String", "APP_ENV", '"production"'
    }
}
```

### Release Signing Configuration

For release builds, you need to configure code signing:

1. **Create keystore.properties:**

    ```bash
    cp android/keystore.properties.example android/keystore.properties
    ```

2. **Generate a release keystore** (if you don't have one):

    ```bash
    keytool -genkeypair -v \
      -keystore apps/mobile/android/app/release.keystore \
      -alias pera-wallet-release \
      -keyalg RSA \
      -keysize 2048 \
      -validity 10000
    ```

3. **Fill in keystore.properties** with your keystore details:

    ```properties
    storeFile=app/release.keystore
    storePassword=your-keystore-password
    keyAlias=pera-wallet-release
    keyPassword=your-key-password
    ```

4. **IMPORTANT**: Never commit `keystore.properties` or the keystore file to git!

### Firebase Configuration

Each flavor needs its own Firebase configuration:

1. Create a Firebase project for each environment (dev, staging, production)
2. Register an Android app in each project with the corresponding application ID:
    - Dev: `com.algorand.android.perarn.dev`
    - Staging: `com.algorand.android.perarn.staging`
    - Production: `com.algorand.android.perarn`
3. Download the `google-services.json` file for each app
4. Place them in the flavor-specific directories:
    - Dev: `app/src/dev/google-services.json`
    - Staging: `app/src/staging/google-services.json`
    - Production: `app/src/production/google-services.json`

See the README files in each `app/src/*/` directory for detailed instructions.

## Building

### List Available Variants

```bash
cd apps/mobile/android
./gradlew tasks --all | grep assemble
```

### Build Specific Variants

**Debug builds** (no keystore needed):

```bash
# Development debug
./gradlew assembleDevDebug

# Staging debug
./gradlew assembleStagingDebug

# Production debug
./gradlew assembleProductionDebug
```

**Release builds** (requires keystore configuration):

```bash
# Development release
./gradlew assembleDevRelease

# Staging release
./gradlew assembleStagingRelease

# Production release
./gradlew assembleProductionRelease
```

### Build AAB (App Bundle) for Play Store

```bash
# Staging
./gradlew bundleStagingRelease

# Production
./gradlew bundleProductionRelease
```

### Build from Package Scripts

You can also use the npm/pnpm scripts:

```bash
# From root or apps/mobile directory
pnpm build:android:dev
pnpm build:android:staging
pnpm build:android:production
```

### Build with Fastlane

```bash
# From apps/mobile directory
bundle exec fastlane android build_dev
bundle exec fastlane android build_staging
bundle exec fastlane android build_production
```

## Installing

**Install specific variant:**

```bash
# Install dev debug
./gradlew installDevDebug

# Install staging release
./gradlew installStagingRelease

# Install production release
./gradlew installProductionRelease
```

**Run specific variant:**

```bash
# Run dev debug
./gradlew :app:installDevDebug && adb shell am start -n com.algorand.android.perarn.dev/.MainActivity

# Or use React Native CLI
pnpm --filter mobile android --variant=devDebug
```

## Output Locations

Built APKs and AABs are located in:

**APKs:**

- `app/build/outputs/apk/dev/debug/app-dev-debug.apk`
- `app/build/outputs/apk/staging/release/app-staging-release.apk`
- `app/build/outputs/apk/production/release/app-production-release.apk`

**AABs (App Bundles):**

- `app/build/outputs/bundle/stagingRelease/app-staging-release.aab`
- `app/build/outputs/bundle/productionRelease/app-production-release.aab`

## Verification Checklist

- [ ] Product flavors are defined in build.gradle
- [ ] Each flavor has a unique applicationId
- [ ] Each flavor has a distinct app name
- [ ] APP_ENV buildConfigField is set for each flavor
- [ ] Release signing configuration is set up
- [ ] keystore.properties file exists (for release builds)
- [ ] google-services.json files are in place for each flavor
- [ ] All variants can be built successfully
- [ ] Apps with different flavors can be installed side-by-side
- [ ] App names and icons are different for each flavor

## Testing

### Test All Variants Build

```bash
# Quick test (no assembling, just checks configuration)
./gradlew tasks

# Build all debug variants
./gradlew assembleDebug

# Build all release variants (requires signing)
./gradlew assembleRelease
```

### Install Multiple Flavors Side-by-Side

Because each flavor has a unique application ID, you can install all three environments on the same device simultaneously:

```bash
# Install all three
./gradlew installDevDebug
./gradlew installStagingRelease
./gradlew installProductionRelease

# Verify all are installed
adb shell pm list packages | grep algorand
```

You should see:

```
package:com.algorand.android.perarn.dev
package:com.algorand.android.perarn.staging
package:com.algorand.android.perarn
```

## Troubleshooting

### "Keystore not found" error

- Ensure `keystore.properties` exists in `apps/mobile/android/`
- Verify the `storeFile` path in keystore.properties is correct
- For OSS/development builds without a release keystore, the build will fall back to debug signing

### "google-services.json not found"

- Ensure the file exists in the correct flavor directory: `app/src/{flavor}/google-services.json`
- Check that the package name in google-services.json matches the applicationId
- If you don't have Firebase configured, the app will still build but Firebase features won't work

### "Execution failed for task ':app:processDevDebugGoogleServices'"

- The google-services.json package name doesn't match the applicationId
- Download the correct google-services.json from Firebase Console for the specific application ID

### Build variant not showing in Android Studio

- Click **File → Sync Project with Gradle Files**
- Rebuild the project: **Build → Rebuild Project**
- Check the Build Variants panel (View → Tool Windows → Build Variants)

### "Duplicate resources" error

- Ensure there are no resource files with the same name in different flavor directories
- Each flavor should only have its own google-services.json

## Advanced Configuration

### Adding Flavor-Specific Resources

You can add flavor-specific resources in `app/src/{flavor}/res/`:

```
app/src/
├── dev/
│   ├── res/
│   │   ├── mipmap-*/     # Dev-specific app icons
│   │   └── values/
│   │       └── strings.xml
│   └── google-services.json
├── staging/
│   ├── res/
│   │   └── ...
│   └── google-services.json
└── production/
    ├── res/
    │   └── ...
    └── google-services.json
```

### Adding Flavor-Specific Source Code

You can add flavor-specific Java/Kotlin code:

```
app/src/
├── main/
│   └── java/com/algorand/android/
├── dev/
│   └── java/com/algorand/android/
│       └── DevConfig.kt  # Only in dev builds
└── production/
    └── java/com/algorand/android/
        └── ProductionConfig.kt  # Only in production builds
```

## Next Steps

After completing the Android setup:

1. Test each build variant
2. Configure Firebase for each environment
3. Set up code signing for release builds
4. Test Fastlane automation
5. Configure CI/CD for automated builds

See `fastlane/README.md` for build automation instructions.
