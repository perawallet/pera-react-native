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
const { withAppBuildGradle } = require('expo/config-plugins');

const TINK_DEPENDENCY = 'com.google.crypto.tink:tink-android:1.18.0';
const TINK_LINE = `    implementation("${TINK_DEPENDENCY}")`;

const patchAppBuildGradle = (contents) => {
  if (contents.includes('com.google.crypto.tink:tink-android')) {
    return contents;
  }
  const patched = contents.replace(
    /^dependencies \{$/m,
    `dependencies {\n${TINK_LINE}`,
  );
  if (patched === contents) {
    throw new Error(
      '[withAndroidMigrationDependencies] could not find `dependencies {` ' +
        'block in app/build.gradle — Expo template may have changed.',
    );
  }
  return patched;
};

const withAndroidMigrationDependencies = (config) =>
  withAppBuildGradle(config, (config) => {
    config.modResults.contents = patchAppBuildGradle(config.modResults.contents);
    return config;
  });

module.exports = withAndroidMigrationDependencies;
module.exports.patchAppBuildGradle = patchAppBuildGradle;
