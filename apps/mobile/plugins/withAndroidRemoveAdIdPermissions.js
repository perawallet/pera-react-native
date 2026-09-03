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
const { withAndroidManifest } = require('expo/config-plugins');

// Firebase Analytics (play-services-measurement, pulled in transitively by
// @react-native-firebase/analytics) injects the advertising-ID permissions at
// manifest-merge time. Pera does no ad attribution — there is no AppsFlyer /
// Adjust / advertisingId use anywhere in the app, only event logging via
// firebase analytics.logEvent — so collecting the advertising ID is an
// unnecessary privacy exposure (and a Play Data-safety disclosure obligation)
// for a wallet. Security finding AND-02.
//
// These nodes are injected from the AAR post-merge, so we can't edit them
// directly; instead we emit `tools:node="remove"` markers so the merger drops
// the library copies. Same technique as withAndroidBlePermissionScoping. This
// stops AD_ID collection without disabling analytics event logging.
const TOOLS_NS = 'http://schemas.android.com/tools';
const AD_ID_PERMISSIONS = [
  'com.google.android.gms.permission.AD_ID',
  'android.permission.ACCESS_ADSERVICES_ATTRIBUTION',
  'android.permission.ACCESS_ADSERVICES_AD_ID',
];

/**
 * Emit `tools:node="remove"` markers for the advertising-ID permissions in a
 * parsed AndroidManifest, so the Gradle manifest merger strips the copies that
 * Firebase Analytics contributes. Pure (mutates + returns the manifest object)
 * so it can be unit-tested without a prebuild. Idempotent.
 *
 * @param {{ manifest: { $?: Record<string,string>, 'uses-permission'?: Array<{ $: Record<string,string> }> } }} androidManifest
 * @returns {typeof androidManifest}
 */
function removeAdIdPermissions(androidManifest) {
  const manifest = androidManifest?.manifest;
  if (!manifest) return androidManifest;

  manifest.$ = manifest.$ ?? {};
  if (!manifest.$['xmlns:tools']) {
    manifest.$['xmlns:tools'] = TOOLS_NS;
  }

  const usesPermissions = (manifest['uses-permission'] =
    manifest['uses-permission'] ?? []);
  for (const name of AD_ID_PERMISSIONS) {
    const hasRemoveMarker = usesPermissions.some(
      (entry) =>
        entry?.$?.['android:name'] === name &&
        entry?.$?.['tools:node'] === 'remove',
    );
    if (!hasRemoveMarker) {
      usesPermissions.push({
        $: { 'android:name': name, 'tools:node': 'remove' },
      });
    }
  }
  return androidManifest;
}

const withAndroidRemoveAdIdPermissions = (config) =>
  withAndroidManifest(config, (config) => {
    removeAdIdPermissions(config.modResults);
    return config;
  });

module.exports = Object.assign(withAndroidRemoveAdIdPermissions, {
  removeAdIdPermissions,
});
