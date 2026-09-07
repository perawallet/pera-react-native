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
const fs = require('node:fs');
const path = require('node:path');
const {
  withAndroidManifest,
  withDangerousMod,
  AndroidConfig,
} = require('expo/config-plugins');

const DRAWABLE_NAME = 'ic_notification_small';
const FCM_ICON_META =
  'com.google.firebase.messaging.default_notification_icon';

/**
 * Absolute path of the notification drawable inside the generated Android
 * project's main res/drawable directory.
 *
 * @param {string} platformProjectRoot the android/ project root
 * @returns {string}
 */
function notificationIconDrawableTarget(platformProjectRoot) {
  return path.join(
    platformProjectRoot,
    'app',
    'src',
    'main',
    'res',
    'drawable',
    `${DRAWABLE_NAME}.xml`,
  );
}

/**
 * Add the FCM default-notification-icon meta-data (pointing at the drawable)
 * to the main <application>. Idempotent.
 *
 * @param {any} androidManifest parsed AndroidManifest.xml
 * @returns {any}
 */
function addNotificationIconMetaData(androidManifest) {
  const app =
    AndroidConfig.Manifest.getMainApplicationOrThrow(androidManifest);
  app['meta-data'] = (app['meta-data'] || []).filter(
    item => item.$?.['android:name'] !== FCM_ICON_META,
  );
  AndroidConfig.Manifest.addMetaDataItemToMainApplication(
    app,
    FCM_ICON_META,
    `@drawable/${DRAWABLE_NAME}`,
    'resource',
  );
  return androidManifest;
}

/**
 * Ships the native white-silhouette notification icon on ALL lanes: copies the
 * vector drawable into res/drawable and registers it as the FCM default
 * notification icon. Without this, Android falls back to the launcher icon and
 * renders a white box in the status bar. The silhouette is monochrome and not a
 * brand/lane differentiator, so it is intentionally applied to every variant.
 *
 * @type {import('expo/config-plugins').ConfigPlugin}
 */
const withAndroidNotificationIcon = config => {
  config = withDangerousMod(config, [
    'android',
    async dangerousConfig => {
      const source = path.join(
        dangerousConfig.modRequest.projectRoot,
        'assets',
        'notification',
        `${DRAWABLE_NAME}.xml`,
      );
      const target = notificationIconDrawableTarget(
        dangerousConfig.modRequest.platformProjectRoot,
      );
      fs.mkdirSync(path.dirname(target), { recursive: true });
      fs.copyFileSync(source, target);
      return dangerousConfig;
    },
  ]);

  config = withAndroidManifest(config, manifestConfig => {
    manifestConfig.modResults = addNotificationIconMetaData(
      manifestConfig.modResults,
    );
    return manifestConfig;
  });

  return config;
};

module.exports = Object.assign(withAndroidNotificationIcon, {
  addNotificationIconMetaData,
  notificationIconDrawableTarget,
});
