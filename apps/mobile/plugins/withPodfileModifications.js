/*
 * Custom config plugin to add necessary Podfile modifications
 * for native dependencies that need special handling
 */

// eslint-disable-next-line @typescript-eslint/no-require-imports
const { withPodfile } = require('@expo/config-plugins');

const withPodfileModifications = (config) => {
  return withPodfile(config, async (podfileConfig) => {
    let contents = podfileConfig.modResults.contents;

    // Add modular headers for Firebase Swift pod compatibility
    // Required because Firebase Swift pods depend on modules that don't define module maps
    if (!contents.includes('use_modular_headers!')) {
      // Add use_modular_headers! after platform line
      contents = contents.replace(
        /(platform\s+:ios.*\n)/,
        `$1\n# Enable modular headers for Firebase Swift pod compatibility\nuse_modular_headers!\n`
      );
    }

    podfileConfig.modResults.contents = contents;
    return podfileConfig;
  });
};

module.exports = withPodfileModifications;
