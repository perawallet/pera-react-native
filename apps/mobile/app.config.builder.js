/*
 Copyright 2022-2026 Pera Wallet, LDA
 Licensed under the Apache License, Version 2.0 (the "License");
 you may not use this file except in compliance with the License.
 You may obtain a copy of the License at http://www.apache.org/licenses/LICENSE-2.0
 Unless required by applicable law or agreed to in writing, software
 distributed under the License is distributed on an "AS IS" BASIS,
 WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 See the License for the specific language governing permissions and
 limitations under the License
 */

// Pure, env-injected builder for the Expo app config. `app.config.js` calls
// this with `process.env`; tests call it with a synthetic env so every
// variant's resolved config can be asserted without mutating process.env.

/* eslint-disable @typescript-eslint/no-require-imports */
const bootsplashManifest = require('./assets/bootsplash/manifest.json');
const { version: packageVersion, versionCodeBase } = require('./package.json');

// iOS build number / Android versionCode floor. The committed base clears the
// live store values (in-place update over the native apps, PERA-4451); adding
// the monotonic CI BUILD_NUMBER keeps each build unique and strictly higher.
function resolveBuildNumber(env) {
  return versionCodeBase + parseInt(env.BUILD_NUMBER || '0', 10);
}

// CFBundleShortVersionString / versionName. CI derives APP_VERSION from the git
// tag; package.json's base (pre-suffix) part is the fallback for local builds.
// Must stay env-driven: fastlane rewrites the iOS project after prebuild, but
// Android ships whatever prebuild bakes into build.gradle, so a static value
// here silently pins every Play release to that number.
function resolveMarketingVersion(env) {
  return env.APP_VERSION || packageVersion.split('-')[0];
}

// Determine app variant based on environment
function getAppVariant(env) {
  switch (env.APP_ENV) {
    case 'staging': { return 'staging';
    }
    case 'production': { return 'production';
    }
    default: { return 'dev';
    }
  }
}

// Bundle/Package identifiers per environment
const bundleIdentifiers = {
  dev: {
    ios: 'com.algorandllc.perarn.staging',
    android: 'com.algorand.perarn.staging',
  },
  staging: {
    ios: 'com.algorandllc.perarn.staging',
    android: 'com.algorand.perarn.staging',
  },
  production: {
    ios: 'com.algorandllc.algorand',
    android: 'com.algorand.android',
  },
};

// App names per environment
const appNames = {
  dev: 'Pera 7 Dev',
  staging: 'Pera 7 Staging',
  production: 'Pera Algo Wallet',
};

// Expo project slugs
const slugs = {
  dev: 'pera-dev',
  staging: 'pera-staging',
  production: 'pera',
};

function buildAppConfig(env) {
  const variant = getAppVariant(env);

  // Legacy native AutoFill extension suffix. Production only: it's the sole
  // variant whose app bundle id matches the native app's, so the only one that
  // can inherit the provider selection (the extension id is app-id + suffix, so
  // both parts must match). Other variants → undefined → plugin no-op.
  // See plugins/withAutofillExtensionBundleId.js.
  const legacyAutofillExtensionSuffix = {
    production: '.autofill-extension',
  }[variant];

  // Production ships the native App Store / Play Store app images; dev and
  // staging keep their current (dark) icon. Production sources are generated
  // from the native Android brand vector (see scripts/generate-production-icons.mjs).
  const appIconIos =
    variant === 'production'
      ? './assets/production/icon-ios.png'
      : './assets/icon-ios.png';
  const androidAdaptiveForeground =
    variant === 'production'
      ? './assets/production/icon-android-foreground.png'
      : './assets/icon-android.png';

  // Passkey autofill (FIDO2) configuration. The site must serve a valid
  // /.well-known/apple-app-site-association linking back to this bundle.
  const PASSKEY_AUTOFILL_SITE =
    env.PASSKEY_AUTOFILL_SITE || 'https://perawallet.app';
  const PASSKEY_AUTOFILL_HOST = (() => {
    try {
      return new URL(PASSKEY_AUTOFILL_SITE).host;
    } catch {
      return PASSKEY_AUTOFILL_SITE.replace(/^https?:\/\//, '').split('/')[0];
    }
  })();

  return {
    name: appNames[variant],
    slug: slugs[variant],
    version: resolveMarketingVersion(env),
    orientation: 'portrait',
    icon: appIconIos,
    scheme: ['perawallet', 'algorand', 'wc', 'perawallet-wc', 'algorand-wc', 'liquid'],
    userInterfaceStyle: 'automatic',

    // iOS-specific configuration
    ios: {
      bundleIdentifier: bundleIdentifiers[variant].ios,
      buildNumber: String(resolveBuildNumber(env)),
      appleTeamId: env.IOS_TEAM_ID,
      supportsTablet: true,
      config: {
        usesNonExemptEncryption: false,
      },
      infoPlist: {
        CFBundleDisplayName: appNames[variant],
        LSApplicationCategoryType: 'public.app-category.finance',
        // Purpose strings are the single source of truth for every iOS
        // permission prompt: an active, specific sentence naming the feature
        // that needs the capability. 7.0.0 (10305) was rejected under
        // guideline 5.1.1(ii) for "Pera needs access to your camera." — a
        // string that says nothing about how the camera is used. Anything
        // vaguer than "app does X so you can Y" will be rejected again, and a
        // plugin option must never be allowed to shadow these (see the
        // expo-image-picker entry below). No $(PRODUCT_NAME): it expands to
        // the spaceless target name (PeraAlgoWallet), and the alert already
        // shows the display name above the string.
        NSCameraUsageDescription:
          'Pera scans QR codes with the camera to fill in a recipient address, add a contact, or connect your account to a dApp.',
        NSBluetoothAlwaysUsageDescription:
          'Pera uses Bluetooth to reach your Ledger hardware wallet so you can review and approve transactions on the device.',
        NSBluetoothPeripheralUsageDescription:
          'Pera uses Bluetooth to reach your Ledger hardware wallet so you can review and approve transactions on the device.',
        NSFaceIDUsageDescription:
          'Pera uses Face ID to unlock your wallet and approve transactions without typing your PIN.',
        NSPhotoLibraryAddUsageDescription:
          'Pera saves a collectible image to your photo library when you choose to download it.',
        NSPhotoLibraryUsageDescription:
          'Pera opens your photo library so you can pick a picture for one of your contacts.',
        // expo-sensors would otherwise inject its own placeholder here; the
        // accelerometer is read only to notice a shake (shake-to-lock).
        NSMotionUsageDescription:
          'Pera reads device motion to notice when you shake your phone, which locks the app straight away.',
        // No NSLocationWhenInUseUsageDescription / NSMicrophoneUsageDescription
        // on purpose: nothing reads either one. Only Android needs location for
        // a BLE scan (ACCESS_FINE_LOCATION below) — CoreBluetooth does not, and
        // an unbacked location string is review surface for no feature.
        // twitter/tg/discord: Linking.canOpenURL checks for the in-app
        // browser's social-media handoff (PWWebView navigation guard).
        LSApplicationQueriesSchemes: ['itms-apps', 'twitter', 'tg', 'com.hammerandchisel.discord'],
        UIRequiredDeviceCapabilities: ['arm64'],
        UIViewControllerBasedStatusBarAppearance: true,
        // Custom fonts
        UIAppFonts: [
          'DMSansRegular.ttf',
          'DMSansMedium.ttf',
          'DMSansSemiBold.ttf',
          'DMSansBold.ttf',
          'DMMonoRegular.ttf',
          'DMMonoMedium.ttf',
        ],
      },
      entitlements: {
         'aps-environment': variant === 'production' ? 'production' : 'development',
        'com.apple.developer.associated-domains': [
          'applinks:perawallet.app',
          // Legacy bare-host universal link — production parity with the
          // native app we ship over. Staging/dev never advertised it and keep
          // their current set (production-only scope).
          ...(variant === 'production' ? ['applinks:perawallet'] : []),
          `webcredentials:${PASSKEY_AUTOFILL_HOST}`,
        ],
        'com.apple.developer.authentication-services.autofill-credential-provider': true,
        // Distributed builds (staging + production) attest against Apple's
        // production environment; only local dev builds use the sandbox.
        'com.apple.developer.devicecheck.appattest-environment':
          variant === 'dev' ? 'development' : 'production',
        'com.apple.developer.declared-age-range': true,
      },
      // Firebase config - stored in config/ directory (not in native folder)
      googleServicesFile: './config/GoogleService-Info.plist',
    },

    // Android-specific configuration
    android: {
      package: bundleIdentifiers[variant].android,
      versionCode: resolveBuildNumber(env),
      adaptiveIcon: {
        foregroundImage: androidAdaptiveForeground,
        backgroundColor: bootsplashManifest.background,
      },
      permissions: [
        'android.permission.INTERNET',
        'android.permission.CAMERA',
        'android.permission.ACCESS_NETWORK_STATE',
        'android.permission.ACCESS_WIFI_STATE',
        'android.permission.USE_BIOMETRIC',
        'android.permission.USE_FINGERPRINT',
        'android.permission.VIBRATE',
        'android.permission.RECEIVE_BOOT_COMPLETED',
        'android.permission.POST_NOTIFICATIONS',
        // BLE permissions for Ledger hardware wallet communication
        'android.permission.BLUETOOTH',
        'android.permission.BLUETOOTH_ADMIN',
        'android.permission.BLUETOOTH_SCAN',
        'android.permission.BLUETOOTH_CONNECT',
        'android.permission.ACCESS_FINE_LOCATION',
      ],
      // Permissions auto-added by linked libraries that native never requested
      // and the RN app does not use — blocked so the merged manifest matches
      // native (no new runtime prompts / store-review flags). Real sources:
      // RECORD_AUDIO from expo-image-picker; READ_MEDIA_AUDIO + READ_MEDIA_VIDEO
      // from expo-media-library; SYSTEM_ALERT_WINDOW is a debug-only react-native
      // overlay permission (never in release — blocked defensively).
      // Confirm the final set against the native pera-android manifest (WB-7).
      blockedPermissions: [
        'android.permission.RECORD_AUDIO',
        'android.permission.SYSTEM_ALERT_WINDOW',
        'android.permission.READ_MEDIA_AUDIO',
        'android.permission.READ_MEDIA_VIDEO',
        // expo-sensors injects ACTIVITY_RECOGNITION for its Pedometer API,
        // which we don't use (only the Accelerometer, for shake detection —
        // that needs no permission). Play classifies any app requesting it as
        // a health app and gates it behind the Health apps policy, so strip it.
        'android.permission.ACTIVITY_RECOGNITION',
        // READ_MEDIA_IMAGES: image pick uses the system photo picker (no
        // permission) and NFT save uses MediaLibrary write-only, so the app
        // needs no broad media access. Play gates this permission under its
        // Photo & Video Permissions policy, so strip it.
        'android.permission.READ_MEDIA_IMAGES',
      ],
      intentFilters: [
        {
          action: 'VIEW',
          data: [
            { scheme: 'perawallet' },
            { scheme: 'algorand' },
            { scheme: 'wc' },
            { scheme: 'perawallet-wc' },
            // Native iOS parity (algorand-wc) + Liquid Auth (liquid). Registered
            // on Android too so there's a single source of truth (WB-8).
            { scheme: 'algorand-wc' },
            { scheme: 'liquid' },
          ],
          category: ['DEFAULT', 'BROWSABLE'],
        },
        {
          action: 'VIEW',
          autoVerify: true,
          data: [
            {
              scheme: 'https',
              host: 'perawallet.app',
              pathPrefix: '/qr/perawallet/',
            },
            {
              scheme: 'https',
              host: 'perawallet.app',
              pathPrefix: '/qr/perawallet-wc/',
            },
          ],
          category: ['DEFAULT', 'BROWSABLE'],
        },
      ],
      allowBackup: false,
      // Firebase config - stored in config/ directory (not in native folder)
      googleServicesFile: './config/google-services.json',
    },

    // Asset bundling
    assetBundlePatterns: ['**/*'],

    // Web configuration (for compatibility, not primary target)
    web: {
      bundler: 'metro',
      output: 'single',
      favicon: './assets/icon-ios.png',
    },

    // Extra configuration accessible at runtime via Constants.expoConfig.extra
    extra: {
      appVariant: variant,
      appEnv: env.APP_ENV || 'production',
    },

    // Expo plugins configuration
    // These modify native code during prebuild
    plugins: [
      // System navigation bar. `AppTheme` inherits Theme.AppCompat.DayNight,
      // which never sets `windowLightNavigationBar`, so the buttons stay light
      // in BOTH system themes and vanish against any light surface under
      // edge-to-edge (targetSdk 36). `style` seeds the build-time default for
      // the light splash; useSystemBarsAppearance then drives it from the
      // user's in-app theme. `enforceContrast: false` is required or Android
      // paints a scrim over that choice.
      [
        'expo-navigation-bar',
        {
          style: 'dark',
          enforceContrast: false,
        },
      ],
      // Expo font loading
      [
        'expo-font',
        {
          fonts: [
            './assets/fonts/DMSansRegular.ttf',
            './assets/fonts/DMSansMedium.ttf',
            './assets/fonts/DMSansSemiBold.ttf',
            './assets/fonts/DMSansBold.ttf',
            './assets/fonts/DMMonoRegular.ttf',
            './assets/fonts/DMMonoMedium.ttf',
          ],
        },
      ],
      // Splash screen configuration
      [
        'expo-splash-screen',
        {
          image: './assets/bootsplash/logo@2x.png',
          imageWidth: bootsplashManifest.logo.width * 2, // @2x
          resizeMode: 'contain',
          backgroundColor: bootsplashManifest.background,
          statusBarTranslucent: true,
          dark: {
            image: './assets/bootsplash/logo@2x.png',
            backgroundColor: bootsplashManifest.background,
          },
        },
      ],
      // Localization
      'expo-localization',

      // Build properties for native compilation
      [
        'expo-build-properties',
        {
          ios: {
            deploymentTarget: '16.4',
            flipper: false,
            // The dev-build network inspector swizzles NSURLSession and
            // bypasses TrustKit, silently disabling SSL pinning
            // (react-native-ssl-public-key-pinning requirement). Debug-only
            // tooling — release builds never include it.
            networkInspector: false,
          },
          android: {
            minSdkVersion: 29,
            targetSdkVersion: 36,
            compileSdkVersion: 36,
            buildToolsVersion: '36.0.0',
            // R8 minification + resource shrinking for release builds.
            // Obfuscates native (Java/Kotlin) symbols and strips unused code/resources,
            // reducing APK/AAB size and hardening the native layer. `enableProguardInReleaseBuilds`
            // is the deprecated alias for this flag. shrinkResources requires minify enabled
            // (validated by expo-build-properties, else prebuild throws).
            enableMinifyInReleaseBuilds: true,
            enableShrinkResourcesInReleaseBuilds: true,
            // Most RN/Expo libraries ship their own consumer ProGuard rules, so R8 respects
            // them automatically. This baseline only keeps JNI bindings and suppresses common
            // optional-dependency warnings. Add module-specific `-keep` rules from the actual
            // release smoke-test / R8 `missing_rules.txt` output rather than speculating —
            // over-keeping silently defeats both the obfuscation and the size reduction.
            extraProguardRules: [
              '# --- Release R8 keep rules (rationale in the comment above) ---',
              '-keepclasseswithmembernames class * { native <methods>; }',
              '-dontwarn okhttp3.**',
              '-dontwarn okio.**',
              '-dontwarn javax.annotation.**',
              '-dontwarn org.conscrypt.**',
              '-keep class org.bouncycastle.** { *; }',
              '-keepnames class org.bouncycastle.** { *; }',
              '-dontwarn org.bouncycastle.**',
            ].join('\n'),
            kotlinVersion: '2.1.20',
            // Package-visibility (API 30+) declarations so Linking.canOpenURL
            // can see the social apps the in-app browser hands off to
            // (PWWebView navigation guard).
            manifestQueries: {
              intent: [
                { action: 'VIEW', data: { scheme: 'twitter' } },
                { action: 'VIEW', data: { scheme: 'tg' } },
                { action: 'VIEW', data: { scheme: 'com.hammerandchisel.discord' } },
              ],
            },
          },
        },
      ],
      // Firebase - reads config from googleServicesFile paths above
      '@react-native-firebase/app',
      '@react-native-firebase/crashlytics',
      // react-native-vision-camera v5 ships no Expo config plugin (v4 did).
      // Camera permission is declared directly: ios.infoPlist.NSCameraUsageDescription
      // + android.permissions 'android.permission.CAMERA' above.
      // Image picker for contact photos
      [
        'expo-image-picker',
        {
          // Permission copy stays in ios.infoPlist above. A truthy option here
          // silently overwrites it — applyPermissions resolves
          // `option || infoPlist[key] || pluginDefault` — which is how 7.0.0
          // shipped "Pera needs access to your camera." over the string this
          // config declares, and got rejected under 5.1.1(ii).
          // The picker only ever opens the photo library (there is no
          // launchCameraAsync call site), so it owns no camera copy; `false`
          // drops the microphone string and RECORD_AUDIO it would add for a
          // recorder the app doesn't have.
          microphonePermission: false,
        },
      ],
      // Note: The following packages are autolinked and don't require config plugins:
      // - expo-sqlite
      // - react-native-mmkv
      // - react-native-keychain
      // - react-native-reanimated
      // - react-native-gesture-handler
      // - react-native-screens
      // - react-native-safe-area-context

      // Custom plugin for Notifee local Maven repository (pnpm/monorepo fix)
      './plugins/withNotifeeMavenRepo',

      // Custom plugin for Ledger USB intent-filter (Android USB host)
      './plugins/withLedgerUsbAndroidManifest',

      // Ship the native white-silhouette notification icon on all lanes
      // (Android falls back to a white box without it). See plugin header.
      './plugins/withAndroidNotificationIcon',

      // Custom plugin for local.properties SDK path (machine-specific fix)
      './plugins/withAndroidLocalProperties',

      // Wire release signing to the Bitrise-injected config/release.keystore
      // (stock Expo template signs release with the debug keystore)
      './plugins/withAndroidReleaseSigning',

      // Emit FULL native debug symbols on release and upload them to Crashlytics
      // so Android native (.so) crashes are symbolicated (iOS dSYM counterpart)
      './plugins/withAndroidNativeSymbolUpload',

      // Enable GWP-ASan so native heap memory-safety crashes surface with
      // allocation stacks in Crashlytics instead of a bare abort.
      './plugins/withAndroidGwpAsan',

      // Raise the Gradle/Kotlin daemon heap — the -Xmx2048m default OOMs this
      // monorepo's Android build. Must run after expo-build-properties so ours wins.
      './plugins/withAndroidGradleHeap',

      // Limit *debug* builds to arm64-v8a (matches native Pera Android) so local
      // builds don't compile all four ABIs. Release keeps every ABI.
      './plugins/withAndroidAbiFilters',

      // Let R8 optimize (the template's proguard-android.txt sets -dontoptimize)
      // and let the resource shrinker remove rather than stub. Must run after
      // expo-build-properties, which owns minify/shrinkResources.
      './plugins/withAndroidR8Optimization',

      // Guard the RN onUserLeaveHint NPE (crash when leaving the app before/after
      // the React host is ready) by overriding it in MainActivity.
      './plugins/withAndroidUserLeaveHintFix',

      // Custom plugin for Podfile modifications (RCT-Folly fix for webassembly)
      './plugins/withPodfileModifications.js',

      // Custom plugin: drop device-only GoogleMLKit from the iOS *simulator*
      // build so Apple Silicon arm64 simulators (iOS 26+) can build. MUST run
      // after withPodfileModifications so its post_install edits land in the
      // same generated Podfile.
      './plugins/withMLKitSimulatorExclusion.js',

      // Custom plugin for Xcode 26+ Swift 6.2 import access levels (SE-0409)
      './plugins/withPublicSwiftImports.js',

      // On-device Falcon-1024 signing (@joe-p/react-native-falcon, PQ-020):
      // pin the New Architecture flag the Nitro module requires. The native
      // pod/Gradle module itself is picked up by RN/Nitro autolinking.
      './plugins/withFalconNitro.js',

      // Custom plugin: exclude the local data stores (MMKV + pera.db) from iOS
      // backups (NSURLIsExcludedFromBackupKey), and on Android from cloud-backup
      // + device-transfer via dataExtractionRules / fullBackupContent — alongside
      // allowBackup:false.
      './plugins/withExcludeDataFromBackup.js',

      // Rename the iOS AutoFill extension bundle id back to the legacy app's
      // suffix so the enabled-provider selection survives the native -> RN
      // upgrade. Registered BEFORE the autofill plugin on purpose: Expo runs
      // withXcodeProject mods in reverse order, so this runs after that plugin
      // creates the extension target.
      [
        './plugins/withAutofillExtensionBundleId',
        { legacySuffix: legacyAutofillExtensionSuffix },
      ],

      // Passkey autofill (FIDO2) — system credential provider extension
      [
        '@algorandfoundation/react-native-passkey-autofill',
        {
          site: PASSKEY_AUTOFILL_SITE,
          label: appNames[variant],
          appGroup: `group.${bundleIdentifiers[variant].ios}`,
          appleTeamId: env.IOS_TEAM_ID,
          aaguid: '418a66da-f981-47e8-814f-19c97f97bd4d',
          biometricRequirement: 'strongOrCredential'
        },
      ],

      // Bundled local workarounds for the autofill plugin's WIP iOS/Android
      // output (Android DP256 Maven repo, iOS unquoted DEVELOPMENT_TEAM, iOS
      // missing extension target dependency + duplicate Sources). MUST run after
      // the autofill plugin. Remove once the fixes land upstream.
      './plugins/withPasskeyAutofillFixes',

      // Restore the production universal-link (applinks) domains that the
      // passkey-autofill plugin drops from associated-domains during prebuild.
      // MUST run after that plugin. Production only — staging/dev keep the
      // autofill plugin's output (production-only scope).
      [
        './plugins/withProductionAssociatedDomains',
        { isProduction: variant === 'production' },
      ],

      // Match native BLE/location permission scoping (maxSdkVersion + neverForLocation).
      './plugins/withAndroidBlePermissionScoping',

      // Strip the advertising-ID permissions that Firebase Analytics injects at
      // manifest-merge time. Pera does no ad attribution, so AD_ID collection is
      // an unnecessary privacy exposure for a wallet (security finding AND-02).
      './plugins/withAndroidRemoveAdIdPermissions',
    ],

    // Experiments (for bleeding edge features)
    experiments: {
      typedRoutes: false,
    },
  };
}

module.exports = { buildAppConfig };
