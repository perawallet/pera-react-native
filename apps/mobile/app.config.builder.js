/*
 Copyright 2022-2025 Pera Wallet, LDA
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
    android: 'com.algorand.perarn',
  },
};

// App names per environment
const appNames = {
  dev: 'Pera 7 Dev',
  staging: 'Pera 7 Staging',
  production: 'Pera 7',
};

// Expo project slugs
const slugs = {
  dev: 'pera-dev',
  staging: 'pera-staging',
  production: 'pera',
};

function buildAppConfig(env) {
  const variant = getAppVariant(env);

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
    version: '7.0.0',
    orientation: 'portrait',
    icon: './assets/icon-ios.png',
    scheme: ['perawallet', 'algorand', 'wc', 'perawallet-wc'],
    userInterfaceStyle: 'automatic',

    // iOS-specific configuration
    ios: {
      bundleIdentifier: bundleIdentifiers[variant].ios,
      buildNumber: env.BUILD_NUMBER || '1',
      appleTeamId: env.IOS_TEAM_ID,
      supportsTablet: true,
      config: {
        usesNonExemptEncryption: false,
      },
      infoPlist: {
        CFBundleDisplayName: appNames[variant],
        LSApplicationCategoryType: 'public.app-category.finance',
        NSCameraUsageDescription: '$(PRODUCT_NAME) needs access to your Camera.',
        NSBluetoothAlwaysUsageDescription: '$(PRODUCT_NAME) will use Bluetooth to communicate with Ledger X.',
        NSBluetoothPeripheralUsageDescription: '$(PRODUCT_NAME) will use Bluetooth to communicate with Ledger X.',
        NSFaceIDUsageDescription: '$(PRODUCT_NAME) uses Face ID to secure access to your wallet.',
        NSPhotoLibraryAddUsageDescription: '$(PRODUCT_NAME) will save QR codes to your photo library.',
        NSPhotoLibraryUsageDescription: '$(PRODUCT_NAME) needs access to your photo library so you can pick a contact photo.',
        NSLocationWhenInUseUsageDescription: '$(PRODUCT_NAME) needs access to your location for Bluetooth communication with Ledger devices.',
        LSApplicationQueriesSchemes: ['itms-apps'],
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
      versionCode: parseInt(env.BUILD_NUMBER || '1', 10),
      adaptiveIcon: {
        foregroundImage: './assets/icon-android.png',
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
        // BLE permissions for Ledger hardware wallet communication
        'android.permission.BLUETOOTH',
        'android.permission.BLUETOOTH_ADMIN',
        'android.permission.BLUETOOTH_SCAN',
        'android.permission.BLUETOOTH_CONNECT',
        'android.permission.ACCESS_FINE_LOCATION',
      ],
      intentFilters: [
        {
          action: 'VIEW',
          data: [
            { scheme: 'perawallet' },
            { scheme: 'algorand' },
            { scheme: 'wc' },
            { scheme: 'perawallet-wc' },
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
          },
          android: {
            minSdkVersion: 24,
            targetSdkVersion: 35,
            compileSdkVersion: 36,
            buildToolsVersion: '35.0.0',
            enableProguardInReleaseBuilds: false,
            kotlinVersion: '2.1.20',
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
          photosPermission: 'Pera needs access to your photo library so you can pick a contact photo.',
          cameraPermission: 'Pera needs access to your camera.',
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

      // Custom plugin for local.properties SDK path (machine-specific fix)
      './plugins/withAndroidLocalProperties',

      // Wire release signing to the Bitrise-injected config/release.keystore
      // (stock Expo template signs release with the debug keystore)
      './plugins/withAndroidReleaseSigning',

      // Custom plugin for Podfile modifications (RCT-Folly fix for webassembly)
      './plugins/withPodfileModifications.js',

      // Custom plugin for Xcode 26+ Swift 6.2 import access levels (SE-0409)
      './plugins/withPublicSwiftImports.js',

      // Custom plugin: one-time migration of MMKV stores from the pre-App-Group
      // sandbox path into the App Group container, so existing iOS installs don't
      // open an empty keystore after the passkey App Group is enabled.
      './plugins/withMMKVAppGroupMigration.js',

      // Custom plugin: exclude the local data stores (MMKV + pera.db) from iOS
      // backups (NSURLIsExcludedFromBackupKey). Android parity is allowBackup:false.
      './plugins/withExcludeDataFromBackup.js',

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

      './plugins/withAgeGate',
    ],

    // Experiments (for bleeding edge features)
    experiments: {
      typedRoutes: false,
    },
  };
}

module.exports = { buildAppConfig };
