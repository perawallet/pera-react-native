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

/* eslint-disable @typescript-eslint/no-require-imports */
const { withEntitlementsPlist } = require('expo/config-plugins');

const ASSOCIATED_DOMAINS_KEY = 'com.apple.developer.associated-domains';

// The production universal-link domains the native iOS app advertised. The
// passkey-autofill plugin rewrites associated-domains to only
// `webcredentials:<host>` during prebuild, dropping these — so universal links
// would break for the production app. We union them back in (production only).
const PRODUCTION_APPLINKS = ['applinks:perawallet.app', 'applinks:perawallet'];

/**
 * Union the production applinks domains into an existing associated-domains
 * list, preserving order and de-duplicating.
 *
 * @param {string[] | undefined} existing
 * @returns {string[]}
 */
function mergeAssociatedDomains(existing) {
  const domains = new Set(existing || []);
  for (const domain of PRODUCTION_APPLINKS) {
    domains.add(domain);
  }
  return [...domains];
}

/**
 * Restores the production applinks domains into the iOS associated-domains
 * entitlement. MUST be registered AFTER the
 * @algorandfoundation/react-native-passkey-autofill plugin so it unions onto
 * that plugin's output. No-op for non-production variants (staging/dev keep the
 * autofill plugin's output — production-only scope).
 *
 * Remove once the autofill plugin preserves pre-existing associated-domains.
 *
 * @type {import('expo/config-plugins').ConfigPlugin<{ isProduction?: boolean }>}
 */
const withProductionAssociatedDomains = (config, { isProduction } = {}) => {
  if (!isProduction) {
    return config;
  }
  return withEntitlementsPlist(config, (config) => {
    config.modResults[ASSOCIATED_DOMAINS_KEY] = mergeAssociatedDomains(
      config.modResults[ASSOCIATED_DOMAINS_KEY],
    );
    return config;
  });
};

module.exports = withProductionAssociatedDomains;
module.exports.mergeAssociatedDomains = mergeAssociatedDomains;
