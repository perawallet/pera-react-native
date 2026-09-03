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
const { withXcodeProject } = require('expo/config-plugins');

/**
 * Preserve the iOS AutoFill provider selection across the native -> RN upgrade.
 *
 * iOS keys the selection to the *extension's* bundle id. The upstream plugin
 * names ours `<app>.PasskeyAutofillCredentialProvider`; the legacy native app
 * used `<app>${legacySuffix}`. Rewriting it back makes iOS treat it as the same
 * extension across the in-place update and keep the selection (undefined
 * `legacySuffix`, e.g. dev/staging, is a no-op).
 *
 * Registered BEFORE the autofill plugin: Expo runs `withXcodeProject` mods in
 * reverse order, so this runs after that plugin creates the extension target.
 * The `<app>${legacySuffix}` App ID needs AutoFill Credential Provider + App
 * Group provisioning for device builds.
 */

// The suffix the autofill plugin gives the extension — unique to it.
const PLUGIN_SUFFIX = '.PasskeyAutofillCredentialProvider';

const unquote = (value) => (value || '').replace(/"/g, '');

/**
 * Rewrites every extension build config's PRODUCT_BUNDLE_IDENTIFIER to
 * `<app>${legacySuffix}`.
 *
 * @param {import('xcode').XcodeProject} project
 * @param {string} legacySuffix e.g. `.autofill-extension`
 */
function retargetExtensionBundleId(project, legacySuffix) {
  const section = project.pbxXCBuildConfigurationSection();
  for (const key of Object.keys(section)) {
    if (key.endsWith('_comment')) continue;
    const settings = section[key] && section[key].buildSettings;
    const id = settings && unquote(settings.PRODUCT_BUNDLE_IDENTIFIER);
    if (id && id.endsWith(PLUGIN_SUFFIX)) {
      const base = id.slice(0, -PLUGIN_SUFFIX.length);
      settings.PRODUCT_BUNDLE_IDENTIFIER = `"${base}${legacySuffix}"`;
    }
  }
}

/**
 * @type {import('expo/config-plugins').ConfigPlugin<{ legacySuffix?: string }>}
 */
const withAutofillExtensionBundleId = (config, { legacySuffix } = {}) => {
  if (!legacySuffix) {
    return config;
  }
  return withXcodeProject(config, (config) => {
    retargetExtensionBundleId(config.modResults, legacySuffix);
    return config;
  });
};

module.exports = Object.assign(withAutofillExtensionBundleId, {
  retargetExtensionBundleId,
});
