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
const { withDangerousMod } = require('expo/config-plugins');
const fs = require('fs');
const path = require('path');

/**
 * Replace the dead `jcenter()` repository with `mavenCentral()`. JCenter shut
 * down and Gradle 9 removed the `jcenter()` method entirely, so build scripts
 * that still call it fail to evaluate ("Could not find method jcenter()").
 *
 * @param {string} buildGradle
 * @returns {string}
 */
function replaceJcenterWithMavenCentral(buildGradle) {
  return buildGradle.replace(/\bjcenter\(\)/g, 'mavenCentral()');
}

/**
 * @type {import('expo/config-plugins').ConfigPlugin}
 *
 * @react-native-cookies/cookies@6.2.1 (a Liquid Auth dependency, used to read
 * the signaling session cookie) ships an android/build.gradle that still calls
 * jcenter(). That method was removed in Gradle 9, which this project uses, so
 * the autolinked module breaks the Android build. Rewrite it during prebuild.
 * Remove once the dependency is upgraded past the jcenter() removal.
 */
const withCookiesJcenterFix = (config) => {
  return withDangerousMod(config, [
    'android',
    (config) => {
      const projectRoot = config.modRequest.projectRoot;

      let buildGradlePath;
      try {
        buildGradlePath = path.join(
          path.dirname(
            require.resolve('@react-native-cookies/cookies/package.json', {
              paths: [projectRoot],
            }),
          ),
          'android',
          'build.gradle',
        );
      } catch {
        console.warn(
          '[withCookiesJcenterFix] @react-native-cookies/cookies not resolvable; skipping.',
        );
        return config;
      }

      if (!fs.existsSync(buildGradlePath)) {
        console.warn(
          `[withCookiesJcenterFix] build.gradle not found at ${buildGradlePath}; skipping.`,
        );
        return config;
      }

      const original = fs.readFileSync(buildGradlePath, 'utf8');
      const patched = replaceJcenterWithMavenCentral(original);

      if (patched !== original) {
        fs.writeFileSync(buildGradlePath, patched);
        console.log(
          '[withCookiesJcenterFix] Replaced jcenter() with mavenCentral() in @react-native-cookies/cookies.',
        );
      }

      return config;
    },
  ]);
};

module.exports = withCookiesJcenterFix;
module.exports.replaceJcenterWithMavenCentral = replaceJcenterWithMavenCentral;
