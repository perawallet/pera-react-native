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

// Match the native app's BLE permission scoping. BLUETOOTH / BLUETOOTH_ADMIN
// are deprecated from API 31; ACCESS_FINE_LOCATION was only needed for BLE
// scanning before API 31. Capping them at maxSdkVersion 30 (and declaring
// BLUETOOTH_SCAN neverForLocation) avoids requesting legacy/location perms on
// modern Android — parity with native. Confirm the exact values against the
// native pera-android manifest.
// Note: react-native-ble-plx already scopes its own BLUETOOTH* copies; this
// scopes the separate copies declared in app.config's android.permissions and
// adds maxSdkVersion to ACCESS_FINE_LOCATION (which ble-plx leaves unscoped).
const MAX_SDK = '30';
const FINE_LOCATION = 'android.permission.ACCESS_FINE_LOCATION';
const COARSE_LOCATION = 'android.permission.ACCESS_COARSE_LOCATION';
const TOOLS_NS = 'http://schemas.android.com/tools';
const MAX_SDK_PERMISSIONS = new Set([
  'android.permission.BLUETOOTH',
  'android.permission.BLUETOOTH_ADMIN',
  FINE_LOCATION,
]);

// rxandroidble injects unscoped <uses-permission-sdk-23> nodes for both
// location permissions at merge time. We drop both: FINE still survives via our
// own scoped <uses-permission ... maxSdkVersion="30"> (kept for BLE scanning on
// API 29-30), while COARSE disappears entirely — it is never usable for BLE
// scanning at minSdk 29 (Android 10+ requires FINE to scan; API 31+ uses
// BLUETOOTH_SCAN/neverForLocation), so requesting it only worsens the app's
// location-permission posture.
const REMOVE_LIBRARY_SDK23 = [FINE_LOCATION, COARSE_LOCATION];

/**
 * Scope the legacy BLE/location permissions in a parsed AndroidManifest.
 * Pure (mutates + returns the manifest object) so it can be unit-tested
 * without a prebuild.
 *
 * @param {{ manifest: { $?: Record<string,string>, 'uses-permission'?: Array<{ $: Record<string,string> }>, 'uses-permission-sdk-23'?: Array<{ $: Record<string,string> }> } }} androidManifest
 * @returns {typeof androidManifest}
 */
function scopeBlePermissions(androidManifest) {
  const manifest = androidManifest?.manifest;
  const usesPermissions = manifest?.['uses-permission'] ?? [];
  for (const permission of usesPermissions) {
    const name = permission?.$?.['android:name'];
    if (MAX_SDK_PERMISSIONS.has(name)) {
      permission.$['android:maxSdkVersion'] = MAX_SDK;
    }
    if (name === 'android.permission.BLUETOOTH_SCAN') {
      permission.$['android:usesPermissionFlags'] = 'neverForLocation';
    }
  }
  removeLibraryLocationSdk23(manifest);
  return androidManifest;
}

/**
 * rxandroidble (pulled in transitively by react-native-ble-plx) contributes
 * UNSCOPED `<uses-permission-sdk-23>` nodes for ACCESS_FINE_LOCATION and
 * ACCESS_COARSE_LOCATION at Gradle manifest-merge time. For FINE, merged with
 * our scoped `<uses-permission ... maxSdkVersion="30">` above, the final
 * manifest declares the permission twice with different maxSdkVersions, which
 * Google Play rejects on upload. Those library nodes don't exist in this app
 * manifest (they're injected from the AAR post-merge), so we can't edit them
 * directly — instead emit `tools:node="remove"` markers, so the merger drops
 * the library copies. FINE survives via our single scoped `<uses-permission>`;
 * COARSE is dropped entirely (see REMOVE_LIBRARY_SDK23).
 *
 * @param {{ $?: Record<string,string>, 'uses-permission-sdk-23'?: Array<{ $: Record<string,string> }> } | undefined} manifest
 */
function removeLibraryLocationSdk23(manifest) {
  if (!manifest) return;

  manifest.$ = manifest.$ ?? {};
  if (!manifest.$['xmlns:tools']) {
    manifest.$['xmlns:tools'] = TOOLS_NS;
  }

  const sdk23 = (manifest['uses-permission-sdk-23'] =
    manifest['uses-permission-sdk-23'] ?? []);
  for (const name of REMOVE_LIBRARY_SDK23) {
    const hasRemoveMarker = sdk23.some(
      (entry) =>
        entry?.$?.['android:name'] === name &&
        entry?.$?.['tools:node'] === 'remove',
    );
    if (!hasRemoveMarker) {
      sdk23.push({ $: { 'android:name': name, 'tools:node': 'remove' } });
    }
  }
}

const withAndroidBlePermissionScoping = (config) =>
  withAndroidManifest(config, (config) => {
    scopeBlePermissions(config.modResults);
    return config;
  });

module.exports = Object.assign(withAndroidBlePermissionScoping, {
  scopeBlePermissions,
});
