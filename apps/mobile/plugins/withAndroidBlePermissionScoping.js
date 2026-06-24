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
const { withAndroidManifest } = require('expo/config-plugins');

// Match the native app's BLE permission scoping. BLUETOOTH / BLUETOOTH_ADMIN
// are deprecated from API 31; ACCESS_FINE_LOCATION was only needed for BLE
// scanning before API 31. Capping them at maxSdkVersion 30 (and declaring
// BLUETOOTH_SCAN neverForLocation) avoids requesting legacy/location perms on
// modern Android — parity with native. Confirm the exact values against the
// native pera-android manifest (WB-7).
// Note: react-native-ble-plx already scopes its own BLUETOOTH* copies; this
// scopes the separate copies declared in app.config's android.permissions and
// adds maxSdkVersion to ACCESS_FINE_LOCATION (which ble-plx leaves unscoped).
const MAX_SDK = '30';
const MAX_SDK_PERMISSIONS = new Set([
  'android.permission.BLUETOOTH',
  'android.permission.BLUETOOTH_ADMIN',
  'android.permission.ACCESS_FINE_LOCATION',
]);

/**
 * Scope the legacy BLE/location permissions in a parsed AndroidManifest.
 * Pure (mutates + returns the manifest object) so it can be unit-tested
 * without a prebuild.
 *
 * @param {{ manifest: { 'uses-permission'?: Array<{ $: Record<string,string> }> } }} androidManifest
 * @returns {typeof androidManifest}
 */
function scopeBlePermissions(androidManifest) {
  const usesPermissions = androidManifest?.manifest?.['uses-permission'] ?? [];
  for (const permission of usesPermissions) {
    const name = permission?.$?.['android:name'];
    if (MAX_SDK_PERMISSIONS.has(name)) {
      permission.$['android:maxSdkVersion'] = MAX_SDK;
    }
    if (name === 'android.permission.BLUETOOTH_SCAN') {
      permission.$['android:usesPermissionFlags'] = 'neverForLocation';
    }
  }
  return androidManifest;
}

const withAndroidBlePermissionScoping = (config) =>
  withAndroidManifest(config, (config) => {
    scopeBlePermissions(config.modResults);
    return config;
  });

module.exports = withAndroidBlePermissionScoping;
module.exports.scopeBlePermissions = scopeBlePermissions;
