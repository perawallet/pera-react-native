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