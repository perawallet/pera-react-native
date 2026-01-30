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
const { withProjectBuildGradle } = require('@expo/config-plugins');

/**
 * @type {import('@expo/config-plugins').ConfigPlugin}
 * 
 * Expo config plugin to add Notifee Maven repository to the project build.gradle.
 */
const withNotifeeMavenRepo = (config) => {
  return withProjectBuildGradle(config, (config) => {
    if (config.modResults.language === 'groovy') {
      config.modResults.contents = addNotifeeMavenRepo(config.modResults.contents);
    }
    return config;
  });
};

function addNotifeeMavenRepo(buildGradle) {
  const mavenRepo = 'maven { url "$rootDir/../node_modules/@notifee/react-native/android/libs" }';
  if (buildGradle.includes(mavenRepo)) {
    return buildGradle;
  }

  // Find the allprojects repositories block and add the Notifee repo
  return buildGradle.replace(
    /allprojects\s*{\s*repositories\s*{/,
    `allprojects {
    repositories {
        ${mavenRepo}`
  );
}

module.exports = withNotifeeMavenRepo;
