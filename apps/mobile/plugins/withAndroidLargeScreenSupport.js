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
 * Drops the Android portrait lock so the app resizes and rotates on large
 * screens (Play Console "Remove resizability and orientation
 * restrictions").
 *
 * From Android 16 the platform *ignores* `screenOrientation` and
 * `resizeableActivity` on large screens, so a tablet rotates whether or not we
 * ask it to. Keeping the lock therefore doesn't prevent landscape — it only
 * hides it from us in development while users still hit it. Removing it makes
 * the behaviour reproducible now, on the tablets and foldables Play is
 * flagging.
 *
 * Only Android is unlocked: the top-level `orientation: 'portrait'` in the app
 * config still pins iOS, where nothing equivalent is being enforced.
 *
 * MainActivity already declares `orientation|screenSize|screenLayout` in
 * `configChanges`, so a rotation is delivered to the running activity instead
 * of recreating it — the phone layouts reflow rather than restart.
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
 * `unspecified` hands the choice to the system rather than forcing landscape:
 * phones keep their sensor default, large screens get the free rotation Play
 * asks for. Explicit rather than deleting the attribute, so a later prebuild
 * that re-adds `portrait` is overwritten rather than silently winning.
 */
function allowRotationAndResize(attributes) {
  return {
    ...attributes,
    'android:screenOrientation': 'unspecified',
    'android:resizeableActivity': 'true',
  };
}

module.exports = withAndroidLargeScreenSupport;
module.exports.allowRotationAndResize = allowRotationAndResize;
