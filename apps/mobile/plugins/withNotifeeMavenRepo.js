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
