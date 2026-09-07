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

/* eslint-disable @typescript-eslint/no-require-imports */
const { withAppBuildGradle } = require('expo/config-plugins');

/**
 * @type {import('expo/config-plugins').ConfigPlugin}
 *
 * Wires app/build.gradle release builds to the keystore Bitrise decodes from
 * $ANDROID_KEYSTORE_BASE64 into apps/mobile/config/release.keystore. The stock
 * Expo template signs release with the debug keystore; prebuild regenerates the
 * file each build, so this mod re-applies on every prebuild.
 *
 * Credentials are read from the environment at Gradle execution time (never
 * baked into the file) and the release buildType is gated on
 * ANDROID_KEYSTORE_PASSWORD so local builds without the secret keep falling
 * back to debug signing.
 */
const withAndroidReleaseSigning = (config) => {
  return withAppBuildGradle(config, (config) => {
    if (config.modResults.language !== 'groovy') {
      throw new Error(
        '[withAndroidReleaseSigning] app/build.gradle is not groovy; cannot patch signing config',
      );
    }
    config.modResults.contents = setReleaseSigningConfig(
      config.modResults.contents,
    );
    return config;
  });
};

function setReleaseSigningConfig(buildGradle) {
  if (buildGradle.includes('signingConfigs.release')) {
    return buildGradle;
  }

  // Point the release buildType at the release signingConfig, but only when the
  // keystore password is present (CI). Anchored inside buildTypes { release { }
  // so the debug buildType's signingConfig is left untouched.
  const swapped = buildGradle.replace(
    /(buildTypes\s*\{[\s\S]*?release\s*\{[\s\S]*?)signingConfig signingConfigs\.debug/,
    "$1signingConfig System.getenv('ANDROID_KEYSTORE_PASSWORD') ? signingConfigs.release : signingConfigs.debug",
  );

  if (swapped === buildGradle) {
    throw new Error(
      '[withAndroidReleaseSigning] could not find the release buildType signingConfig to replace',
    );
  }

  const releaseSigningConfig = [
    '        release {',
    "            storeFile file(System.getenv('ANDROID_KEYSTORE_PATH') ?: '../../config/release.keystore')",
    "            storePassword System.getenv('ANDROID_KEYSTORE_PASSWORD')",
    "            keyAlias System.getenv('ANDROID_KEY_ALIAS')",
    "            keyPassword System.getenv('ANDROID_KEY_PASSWORD')",
    '        }',
    '',
  ].join('\n');

  const declared = swapped.replace(
    /signingConfigs\s*\{\s*\n/,
    (match) => `${match}${releaseSigningConfig}\n`,
  );

  if (declared === swapped) {
    throw new Error(
      '[withAndroidReleaseSigning] could not find the signingConfigs block to extend',
    );
  }

  return declared;
}

module.exports = Object.assign(withAndroidReleaseSigning, {
  setReleaseSigningConfig,
});
