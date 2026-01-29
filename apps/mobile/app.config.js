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

// Dynamic Expo configuration
// This replaces app.json for more flexible configuration
// All native configurations are defined here so ios/android folders can be generated on demand

const IS_DEV = process.env.APP_ENV === 'development';
const IS_STAGING = process.env.APP_ENV === 'staging';

// Determine app variant based on environment
const getAppVariant = () => {
  if (IS_DEV) return 'dev';
  if (IS_STAGING) return 'staging';
  return 'production';
};

const variant = getAppVariant();

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
    ios: 'com.algorandllc.perarn',
    android: 'com.algorand.perarn',
  },
};

// App names per environment
const appNames = {
  dev: 'Pera Dev',
  staging: 'Pera Staging',
  production: 'Pera',
};

// Expo project slugs (must be unique per variant for EAS)
const slugs = {
  dev: 'pera-dev',
  staging: 'pera-staging',
  production: 'pera',
};

module.exports = {
  name: appNames[variant],
  slug: slugs[variant],
  version: '7.0.0',
  orientation: 'portrait',
  icon: './assets/bootsplash/logo@4x.png',
  scheme: ['perawallet', 'algorand', 'wc', 'perawallet-wc'],
  userInterfaceStyle: 'automatic',
  newArchEnabled: true,

  // Splash screen configuration (basic - plugin config below for full control)
  splash: {
    image: './assets/bootsplash/logo@2x.png',
    resizeMode: 'contain',
    backgroundColor: '#FFFFFF',
  },

  // iOS-specific configuration
  ios: {
    bundleIdentifier: bundleIdentifiers[variant].ios,
    buildNumber: process.env.BUILD_NUMBER || '1',
    supportsTablet: true,
    config: {
      usesNonExemptEncryption: false,
    },
    infoPlist: {
      CFBundleDisplayName: appNames[variant],
      LSApplicationCategoryType: 'public.app-category.finance',
      NSCameraUsageDescription: '$(PRODUCT_NAME) needs access to your Camera.',
      NSBluetoothAlwaysUsageDescription: 'Pera will use Bluetooth to communicate with Ledger X.',
      NSBluetoothPeripheralUsageDescription: 'Pera will use Bluetooth to communicate with Ledger X.',
      NSFaceIDUsageDescription: '$(PRODUCT_NAME) uses Face ID to secure access to your wallet.',
      NSPhotoLibraryAddUsageDescription: 'Pera will save QR codes to your photo library.',
      LSApplicationQueriesSchemes: ['itms-apps'],
      UIRequiredDeviceCapabilities: ['arm64'],
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
      'com.apple.developer.associated-domains': ['applinks:perawallet.app'],
    },
    // Firebase config - stored in config/ directory (not in native folder)
    googleServicesFile: './config/GoogleService-Info.plist',
  },

  // Android-specific configuration
  android: {
    package: bundleIdentifiers[variant].android,
    versionCode: parseInt(process.env.BUILD_NUMBER || '1', 10),
    adaptiveIcon: {
      foregroundImage: './assets/bootsplash/logo@4x.png',
      backgroundColor: '#FFFFFF',
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
    ],
    intentFilters: [
      {
        action: 'VIEW',
        autoVerify: true,
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
          { scheme: 'https', host: 'perawallet.app', pathPrefix: '/qr' },
          { scheme: 'https', host: 'perawallet.app', pathPrefix: '/app' },
        ],
        category: ['DEFAULT', 'BROWSABLE'],
      },
    ],
    // Firebase config - stored in config/ directory (not in native folder)
    googleServicesFile: './config/google-services.json',
  },

  // Asset bundling
  assetBundlePatterns: ['**/*'],

  // Web configuration (for compatibility, not primary target)
  web: {
    bundler: 'metro',
    output: 'single',
    favicon: './assets/bootsplash/logo@2x.png',
  },

  // Extra configuration accessible at runtime via Constants.expoConfig.extra
  extra: {
    appVariant: variant,
    appEnv: process.env.APP_ENV || 'production',
    eas: {
      projectId: process.env.EAS_PROJECT_ID,
    },
  },

  // Runtime version for OTA updates (if using EAS Update)
  runtimeVersion: {
    policy: 'appVersion',
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
        imageWidth: 200,
        resizeMode: 'contain',
        backgroundColor: '#FFFFFF',
        dark: {
          image: './assets/bootsplash/logo@2x.png',
          backgroundColor: '#1C1C1E',
        },
      },
    ],
    // Build properties for native compilation
    [
      'expo-build-properties',
      {
        ios: {
          deploymentTarget: '16.0',
          newArchEnabled: true,
          flipper: false,
        },
        android: {
          minSdkVersion: 24,
          targetSdkVersion: 35,
          compileSdkVersion: 35,
          buildToolsVersion: '35.0.0',
          newArchEnabled: true,
          enableProguardInReleaseBuilds: false,
          kotlinVersion: '2.0.21',
        },
      },
    ],
    // Firebase - reads config from googleServicesFile paths above
    '@react-native-firebase/app',
    '@react-native-firebase/crashlytics',
    // Vision Camera for QR code scanning
    [
      'react-native-vision-camera',
      {
        cameraPermissionText: 'Pera needs access to your camera to scan QR codes.',
        enableCodeScanner: true,
      },
    ],
    // Note: The following packages are autolinked and don't require config plugins:
    // - react-native-mmkv
    // - react-native-keychain
    // - react-native-reanimated
    // - react-native-gesture-handler
    // - react-native-screens
    // - react-native-safe-area-context

    // Custom plugin for Podfile modifications (RCT-Folly fix for webassembly)
    './plugins/withPodfileModifications.js',
  ],

  // Experiments (for bleeding edge features)
  experiments: {
    typedRoutes: false,
  },
};
