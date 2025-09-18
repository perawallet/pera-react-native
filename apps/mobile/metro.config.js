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
    resolveRequest: (context, moduleName, platform) => {
        if (moduleName === 'crypto') {
            const result = context.resolveRequest(
                context,
                'react-native-quick-crypto',
                platform,
            )

            return result
        }
        if (moduleName === 'buffer') {
            return context.resolveRequest(
                context,
                '@craftzdog/react-native-buffer',
                platform,
            )
        }
        if (moduleName === 'stream') {
            return context.resolveRequest(
                context,
                'readable-stream',
                platform,
            )
        }
        if (moduleName === 'base64-js') {
            return context.resolveRequest(
                context,
                'react-native-quick-base64',
                platform,
            )
        }
        // else if (moduleName === 'stream') {
        //     return context.resolveRequest(
        //         context,
        //         'readable-stream',
        //         platform,
        //     )
        // }
        // Optionally, chain to the standard Metro resolver.
        return context.resolveRequest(context, moduleName, platform);
    },
  },
  // this specifies the folder where the node_modules are
  watchFolders: [
    path.join(__dirname, '..', '..'), 
    path.join(__dirname, 'assets'), 
    __dirname
  ],
};
module.exports = mergeConfig(defaultConfig, config);