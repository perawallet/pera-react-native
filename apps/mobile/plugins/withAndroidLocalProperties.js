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

      // Default to the standard macOS Android SDK location
      const homeDir = process.env.HOME || '/Users/fred';
      const sdkPath = path.join(homeDir, 'Library/Android/sdk');

      if (fs.existsSync(sdkPath)) {
        const content = `sdk.dir=${sdkPath}\n`;
        fs.writeFileSync(localPropertiesPath, content);
        console.log(`[withAndroidLocalProperties] Created local.properties with sdk.dir=${sdkPath}`);
      } else {
        console.warn(`[withAndroidLocalProperties] Could not find Android SDK at ${sdkPath}`);
      }

      return config;
    },
  ]);
};

module.exports = withAndroidLocalProperties;
