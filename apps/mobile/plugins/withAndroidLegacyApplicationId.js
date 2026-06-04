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
const { withAppBuildGradle } = require('@expo/config-plugins');

const APPLICATION_ID_RE = /applicationId\s+(['"])[^'"]*\1/;

const BUILD_TYPES_DEBUG_RE = /(buildTypes\s*\{\s*debug\s*\{)/;

const setApplicationId = (contents, applicationId) => {
  if (!APPLICATION_ID_RE.test(contents)) {
    throw new Error(
      '[withAndroidLegacyApplicationId] could not find an `applicationId` ' +
        'declaration in app/build.gradle — Expo template may have changed.',
    );
  }
  return contents.replace(APPLICATION_ID_RE, `applicationId '${applicationId}'`);
};

const addDebugSuffix = (contents, debugSuffix) => {
  if (contents.includes('applicationIdSuffix')) {
    return contents;
  }
  if (!BUILD_TYPES_DEBUG_RE.test(contents)) {
    throw new Error(
      '[withAndroidLegacyApplicationId] could not find the `buildTypes { ' +
        'debug {` block in app/build.gradle — Expo template may have changed.',
    );
  }
  return contents.replace(
    BUILD_TYPES_DEBUG_RE,
    `$1\n            applicationIdSuffix "${debugSuffix}"`,
  );
};

const patchAppBuildGradle = (contents, { applicationId, debugSuffix }) => {
  if (!applicationId) {
    throw new Error(
      '[withAndroidLegacyApplicationId] missing required `applicationId` option.',
    );
  }
  let patched = setApplicationId(contents, applicationId);
  if (debugSuffix) {
    patched = addDebugSuffix(patched, debugSuffix);
  }
  return patched;
};

const withAndroidLegacyApplicationId = (config, props = {}) =>
  withAppBuildGradle(config, (config) => {
    config.modResults.contents = patchAppBuildGradle(
      config.modResults.contents,
      props,
    );
    return config;
  });

module.exports = withAndroidLegacyApplicationId;
module.exports.patchAppBuildGradle = patchAppBuildGradle;
module.exports.setApplicationId = setApplicationId;
module.exports.addDebugSuffix = addDebugSuffix;
