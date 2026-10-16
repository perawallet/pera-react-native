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
const { withMainApplication } = require('expo/config-plugins');

/**
 * @type {import('expo/config-plugins').ConfigPlugin}
 *
 * Guards a React Native 0.86 native crash in
 * `FabricUIManagerBinding::findNextFocusableElement`: an auto-focused input in a
 * scroll view makes Android run focusSearch on the UI thread, which walks a
 * shadow tree root the JS thread can free mid-walk. RN's fix sits behind
 * `fixFindShadowNodeByTagRaceCondition` (off by default; always on from 0.87, so
 * drop this plugin on that upgrade). The flags are already set by
 * `loadReactNative`, and a second `override` throws, so this force-overrides
 * with the stable preset (identical to the new-architecture defaults) plus the
 * flag. Non-stable release levels keep their own preset untouched.
 */
const MARKER = 'fixFindShadowNodeByTagRaceCondition';

const OVERRIDE = [
  '    if (DefaultNewArchitectureEntryPoint.releaseLevel == ReleaseLevel.STABLE) {',
  '      com.facebook.react.internal.featureflags.ReactNativeFeatureFlags.dangerouslyForceOverride(',
  '        object : com.facebook.react.internal.featureflags.ReactNativeNewArchitectureFeatureFlagsDefaults() {',
  `          override fun ${MARKER}(): Boolean = true`,
  '        }',
  '      )',
  '    }',
].join('\n');

const withAndroidFindShadowNodeRaceFix = (config) =>
  withMainApplication(config, (config) => {
    if (config.modResults.language !== 'kt') {
      throw new Error(
        '[withAndroidFindShadowNodeRaceFix] MainApplication is not Kotlin; cannot patch',
      );
    }
    config.modResults.contents = addFindShadowNodeRaceFix(
      config.modResults.contents,
    );
    return config;
  });

/** Inject the override right after `loadReactNative(this)`. Idempotent. */
function addFindShadowNodeRaceFix(mainApplication) {
  if (mainApplication.includes(MARKER)) {
    return mainApplication;
  }

  const patched = mainApplication.replace(
    /^(\s*loadReactNative\(this\)\s*\n)/m,
    `$1${OVERRIDE}\n`,
  );

  if (patched === mainApplication) {
    throw new Error(
      '[withAndroidFindShadowNodeRaceFix] could not find loadReactNative(this) to patch',
    );
  }

  return patched;
}

module.exports = Object.assign(withAndroidFindShadowNodeRaceFix, {
  addFindShadowNodeRaceFix,
});
