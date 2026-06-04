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

// eslint-disable-next-line @typescript-eslint/no-require-imports
const { withDangerousMod } = require('expo/config-plugins');
// eslint-disable-next-line @typescript-eslint/no-require-imports
const fs = require('fs');
// eslint-disable-next-line @typescript-eslint/no-require-imports
const path = require('path');

const SOURCE_DIR_REL_TO_PROJECT = 'migration-android';
const ANDROID_JAVA_SRC_REL = 'app/src/main/java';
const MIGRATION_PACKAGE_PATH = 'com/algorand/perarn/migration';

// eslint-disable-next-line no-console
const warn = (msg) => console.warn(`[withAndroidMigrationSources] ${msg}`);

const isKotlinSource = (filename) => filename.endsWith('.kt');

const copyKotlinTree = (srcDir, destDir) => {
  fs.mkdirSync(destDir, { recursive: true });
  for (const entry of fs.readdirSync(srcDir, { withFileTypes: true })) {
    const src = path.join(srcDir, entry.name);
    const dest = path.join(destDir, entry.name);
    if (entry.isDirectory()) {
      copyKotlinTree(src, dest);
    } else if (entry.isFile() && isKotlinSource(entry.name)) {
      fs.copyFileSync(src, dest);
    }
  }
};

const withAndroidMigrationSources = (config) =>
  withDangerousMod(config, [
    'android',
    async (config) => {
      const { projectRoot, platformProjectRoot } = config.modRequest;
      const sourceDirAbs = path.join(projectRoot, SOURCE_DIR_REL_TO_PROJECT);
      const javaSrcAbs = path.join(platformProjectRoot, ANDROID_JAVA_SRC_REL);
      const destMigrationAbs = path.join(javaSrcAbs, MIGRATION_PACKAGE_PATH);

      if (!fs.existsSync(sourceDirAbs)) {
        warn(
          `canonical source dir "${SOURCE_DIR_REL_TO_PROJECT}/" not found — skipping copy.`,
        );
        return config;
      }

      fs.rmSync(destMigrationAbs, { recursive: true, force: true });
      copyKotlinTree(sourceDirAbs, javaSrcAbs);

      return config;
    },
  ]);

module.exports = withAndroidMigrationSources;
