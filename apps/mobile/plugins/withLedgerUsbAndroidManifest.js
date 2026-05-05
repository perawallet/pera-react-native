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
const path = require('path');
const fs = require('fs');
const {
  withAndroidManifest,
  withDangerousMod,
  AndroidConfig,
} = require('@expo/config-plugins');

const USB_INTENT_ACTION = 'android.hardware.usb.action.USB_DEVICE_ATTACHED';
const DEVICE_FILTER_RESOURCE_NAME = 'usb_device_filter';

const DEVICE_FILTER_XML = `<?xml version="1.0" encoding="utf-8"?>
<resources>
    <!-- Ledger USB vendor ID 0x2C97 (decimal 11415).
         Vendor-only filter matches all current Ledger products
         (Nano S, Nano X, Nano S Plus, Stax, Flex, future models). -->
    <usb-device vendor-id="11415" />
</resources>
`;

/**
 * @type {import('@expo/config-plugins').ConfigPlugin}
 *
 * Adds the USB_DEVICE_ATTACHED intent-filter and meta-data to the
 * MainActivity, plus the res/xml/usb_device_filter.xml resource.
 * Also declares <uses-feature android:name="android.hardware.usb.host" required="false">
 * so the Play Store doesn't filter Pera off non-USB-host devices.
 */
const withLedgerUsbAndroidManifest = (config) => {
  config = withAndroidManifest(config, async (cfg) => {
    const mainActivity = AndroidConfig.Manifest.getMainActivityOrThrow(
      cfg.modResults,
    );

    const hasIntentFilter = (mainActivity['intent-filter'] ?? []).some((f) =>
      (f.action ?? []).some((a) => a.$['android:name'] === USB_INTENT_ACTION),
    );
    if (!hasIntentFilter) {
      mainActivity['intent-filter'] = [
        ...(mainActivity['intent-filter'] ?? []),
        {
          action: [
            {
              $: {
                'android:name': USB_INTENT_ACTION,
              },
            },
          ],
        },
      ];
    }

    const hasMetaData = (mainActivity['meta-data'] ?? []).some(
      (m) => m.$['android:name'] === USB_INTENT_ACTION,
    );
    if (!hasMetaData) {
      mainActivity['meta-data'] = [
        ...(mainActivity['meta-data'] ?? []),
        {
          $: {
            'android:name': USB_INTENT_ACTION,
            'android:resource': `@xml/${DEVICE_FILTER_RESOURCE_NAME}`,
          },
        },
      ];
    }

    const usesFeatures = cfg.modResults.manifest['uses-feature'] ?? [];
    const hasUsbFeature = usesFeatures.some(
      (f) => f.$['android:name'] === 'android.hardware.usb.host',
    );
    if (!hasUsbFeature) {
      cfg.modResults.manifest['uses-feature'] = [
        ...usesFeatures,
        {
          $: {
            'android:name': 'android.hardware.usb.host',
            'android:required': 'false',
          },
        },
      ];
    }

    return cfg;
  });

  config = withDangerousMod(config, [
    'android',
    async (cfg) => {
      const xmlDir = path.join(
        cfg.modRequest.platformProjectRoot,
        'app',
        'src',
        'main',
        'res',
        'xml',
      );
      fs.mkdirSync(xmlDir, { recursive: true });
      fs.writeFileSync(
        path.join(xmlDir, `${DEVICE_FILTER_RESOURCE_NAME}.xml`),
        DEVICE_FILTER_XML,
      );
      return cfg;
    },
  ]);

  return config;
};

module.exports = withLedgerUsbAndroidManifest;
