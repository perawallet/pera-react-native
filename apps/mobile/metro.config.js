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
const { getDefaultConfig, mergeConfig } = require('@react-native/metro-config');
// eslint-disable-next-line @typescript-eslint/no-require-imports
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
            // Handle path aliases
            const aliasMap = {
                '@components': path.resolve(__dirname, 'src/components'),
                '@providers': path.resolve(__dirname, 'src/providers'),
                '@routes': path.resolve(__dirname, 'src/routes'),
                '@hooks': path.resolve(__dirname, 'src/hooks'),
                '@constants': path.resolve(__dirname, 'src/constants'),
                '@modules': path.resolve(__dirname, 'src/modules'),
                '@assets': path.resolve(__dirname, 'assets'),
                '@theme': path.resolve(__dirname, 'src/theme'),
                '@layouts': path.resolve(__dirname, 'src/layouts'),
            };

            for (const [alias, aliasPath] of Object.entries(aliasMap)) {
                if (moduleName.startsWith(alias + '/')) {
                    const modulePath = moduleName.substring(alias.length + 1);
                    const fullPath = path.join(aliasPath, modulePath);

                    return context.resolveRequest(
                        context,
                        fullPath,
                        platform,
                    );
                }
            }

            // Handle crypto polyfills - resolve from mobile app's node_modules
            // regardless of where the import originates (fixes xhdwallet imports)
            // Include both the Node.js module names AND the polyfill package names
            const polyfillMap = {
                // Node.js core modules
                'crypto': path.resolve(__dirname, 'node_modules/react-native-quick-crypto'),
                'buffer': path.resolve(__dirname, 'node_modules/@craftzdog/react-native-buffer'),
                'stream': path.resolve(__dirname, 'node_modules/readable-stream'),
                'base64-js': path.resolve(__dirname, 'node_modules/react-native-quick-base64'),
                'util': path.resolve(__dirname, 'node_modules/util'),
                // Polyfill package names (for when Babel has already transformed the import)
                'react-native-quick-crypto': path.resolve(__dirname, 'node_modules/react-native-quick-crypto'),
                '@craftzdog/react-native-buffer': path.resolve(__dirname, 'node_modules/@craftzdog/react-native-buffer'),
                'readable-stream': path.resolve(__dirname, 'node_modules/readable-stream'),
                'react-native-quick-base64': path.resolve(__dirname, 'node_modules/react-native-quick-base64'),
            };

            if (polyfillMap[moduleName]) {
                return {
                    filePath: require.resolve(polyfillMap[moduleName]),
                    type: 'sourceFile',
                };
            }

            // Resolve @perawallet workspace packages to source files for development
            // This prevents module duplication issues with lazy store initialization
            if (moduleName === '@perawallet/wallet-core') {
                const sourcePath = path.resolve(__dirname, '..', '..', 'packages', 'core', 'src', 'index.ts');
                try {
                    require.resolve(sourcePath);
                    return context.resolveRequest(context, sourcePath, platform);
                } catch {
                    // Fall through to default resolution
                }
            }
            if (moduleName.startsWith('@perawallet/wallet-core-') && !moduleName.includes('devtools')) {
                const packageName = moduleName.replace('@perawallet/wallet-core-', '');
                const sourcePath = path.resolve(__dirname, '..', '..', 'packages', packageName, 'src', 'index.ts');
                try {
                    require.resolve(sourcePath);
                    return context.resolveRequest(context, sourcePath, platform);
                } catch {
                    // Fall through to default resolution
                }
            }

            // Chain to the standard Metro resolver
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