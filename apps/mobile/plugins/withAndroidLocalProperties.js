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
/* eslint-disable no-console */
const { withDangerousMod } = require('@expo/config-plugins');
const fs = require('fs');
const path = require('path');

/**
 * @type {import('@expo/config-plugins').ConfigPlugin}
 * 
 * Expo config plugin to ensure local.properties exists with the correct SDK path.
 */
const withAndroidLocalProperties = (config) => {
  return withDangerousMod(config, [
    'android',
    async (config) => {
      const projectRoot = config.modRequest.projectRoot;
      const localPropertiesPath = path.join(projectRoot, 'android', 'local.properties');

      const getSDKPath = () => {
        if (process.env.ANDROID_HOME) return process.env.ANDROID_HOME;
        if (process.env.ANDROID_SDK_ROOT) return process.env.ANDROID_SDK_ROOT;

        const homeDir = require('os').homedir();

        switch (process.platform) {
          case 'darwin':
            return path.join(homeDir, 'Library/Android/sdk');
          case 'win32':
            return path.join(process.env.LOCALAPPDATA || path.join(homeDir, 'AppData', 'Local'), 'Android', 'Sdk');
          case 'linux':
            return path.join(homeDir, 'Android', 'Sdk');
          default:
            return null;
        }
      };

      const sdkPath = getSDKPath();

      if (sdkPath && fs.existsSync(sdkPath)) {
        const content = `sdk.dir=${sdkPath.replace(/\\/g, '/')}\n`;
        fs.writeFileSync(localPropertiesPath, content);
        console.log(`[withAndroidLocalProperties] Created local.properties with sdk.dir=${sdkPath}`);
      } else {
        console.warn(`[withAndroidLocalProperties] Could not find Android SDK. Please set ANDROID_HOME environment variable.`);
      }

      return config;
    },
  ]);
};

module.exports = withAndroidLocalProperties;
