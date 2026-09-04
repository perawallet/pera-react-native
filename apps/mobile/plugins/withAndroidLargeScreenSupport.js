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
const { AndroidConfig, withAndroidManifest } = require('expo/config-plugins');

/**
 * @type {import('expo/config-plugins').ConfigPlugin}
 *
 * Lets large screens rotate and resize (Play Console "Remove resizability and
 * orientation restrictions") **without** unlocking rotation on phones, which
 * are not laid out for landscape.
 *
 * A per-size manifest lock is impossible: `android:screenOrientation` is an
 * `ActivityInfo` enum the package parser resolves once, at install time,
 * through an AssetManager with every configuration axis zeroed. A
 * `values-sw600dp` qualifier can therefore never win there — verified on an
 * sw800dp API 30 tablet, which resolved the unqualified value and forced the
 * display to portrait. Play's manifest analysis reads that same static value,
 * so a lock declared here would keep the listing flagged too.
 *
 * So the manifest declares no restriction, and `useOrientationPolicy`
 * (src/hooks) locks phones to portrait at runtime, where the live screen size
 * is actually known.
 *
 * Only Android needs this: iOS is per-idiom static — the top-level
 * `orientation: 'portrait'` pins iPhones while `supportsTablet` writes an
 * all-orientations `UISupportedInterfaceOrientations~ipad`, so iPads rotate.
 */
const withAndroidLargeScreenSupport = (config) => {
  return withAndroidManifest(config, (config) => {
    const mainActivity = AndroidConfig.Manifest.getMainActivityOrThrow(
      config.modResults,
    );

    mainActivity.$ = allowRotationAndResize(mainActivity.$);

    return config;
  });
};

/**
 * `unspecified` rather than deleting the attribute, so a later prebuild that
 * re-adds `portrait` from the app config is overwritten rather than silently
 * winning.
 */
function allowRotationAndResize(attributes) {
  return {
    ...attributes,
    'android:screenOrientation': 'unspecified',
    'android:resizeableActivity': 'true',
  };
}

module.exports = Object.assign(withAndroidLargeScreenSupport, {
  allowRotationAndResize,
});
