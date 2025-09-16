const {getDefaultConfig, mergeConfig} = require('@react-native/metro-config');
const path = require('path');

const defaultConfig = getDefaultConfig(__dirname);
const { assetExts, sourceExts } = defaultConfig.resolver;

/**
 * Metro configuration
 * <https://reactnative.dev/docs/metro>
 *
 * @type {import('metro-config').MetroConfig}
 */
const config = {
  transformer: {
    babelTransformerPath: require.resolve("react-native-svg-transformer")
  },
  resolver: {
    assetExts: assetExts.filter((ext) => ext !== "svg"),
    sourceExts: [...sourceExts, "svg"],
    unstable_enableSymlinks: true, 
    unstable_enablePackageExports: true,
  },
  // this specifies the folder where the node_modules are
  watchFolders: [
    path.join(__dirname, '..', '..'), 
    path.join(__dirname, 'assets'), 
    __dirname
  ],
};
module.exports = mergeConfig(defaultConfig, config);