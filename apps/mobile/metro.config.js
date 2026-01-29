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

// Learn more https://docs.expo.dev/guides/customizing-metro
// eslint-disable-next-line @typescript-eslint/no-require-imports
const { getDefaultConfig } = require('expo/metro-config');
// eslint-disable-next-line @typescript-eslint/no-require-imports
const path = require('path');

// Find the monorepo root (2 levels up from apps/mobile)
const projectRoot = __dirname;
const monorepoRoot = path.resolve(projectRoot, '../..');

const defaultConfig = getDefaultConfig(projectRoot);

// Watch all files in the monorepo
const watchFolders = [monorepoRoot];

// Configure the resolver for monorepo and custom needs
const nodeModulesPaths = [
    path.resolve(projectRoot, 'node_modules'),
    path.resolve(monorepoRoot, 'node_modules'),
];

// SVG transformer configuration
const { assetExts, sourceExts } = defaultConfig.resolver;

// Path alias map
const aliasMap = {
    '@components': path.resolve(projectRoot, 'src/components'),
    '@providers': path.resolve(projectRoot, 'src/providers'),
    '@routes': path.resolve(projectRoot, 'src/routes'),
    '@hooks': path.resolve(projectRoot, 'src/hooks'),
    '@constants': path.resolve(projectRoot, 'src/constants'),
    '@modules': path.resolve(projectRoot, 'src/modules'),
    '@assets': path.resolve(projectRoot, 'assets'),
    '@theme': path.resolve(projectRoot, 'src/theme'),
    '@layouts': path.resolve(projectRoot, 'src/layouts'),
};

// Crypto polyfill map
const polyfillMap = {
    // Node.js core modules
    'crypto': path.resolve(projectRoot, 'node_modules/react-native-quick-crypto'),
    'buffer': path.resolve(projectRoot, 'node_modules/@craftzdog/react-native-buffer'),
    'stream': path.resolve(projectRoot, 'node_modules/readable-stream'),
    'base64-js': path.resolve(projectRoot, 'node_modules/react-native-quick-base64'),
    'util': path.resolve(projectRoot, 'node_modules/util'),
    // Polyfill package names (for when Babel has already transformed the import)
    'react-native-quick-crypto': path.resolve(projectRoot, 'node_modules/react-native-quick-crypto'),
    '@craftzdog/react-native-buffer': path.resolve(projectRoot, 'node_modules/@craftzdog/react-native-buffer'),
    'readable-stream': path.resolve(projectRoot, 'node_modules/readable-stream'),
    'react-native-quick-base64': path.resolve(projectRoot, 'node_modules/react-native-quick-base64'),
};

// Custom resolver function
const customResolveRequest = (context, moduleName, platform) => {
    // Handle path aliases
    for (const [alias, aliasPath] of Object.entries(aliasMap)) {
        if (moduleName.startsWith(alias + '/')) {
            const modulePath = moduleName.substring(alias.length + 1);
            const fullPath = path.join(aliasPath, modulePath);
            return context.resolveRequest(context, fullPath, platform);
        }
    }

    // Handle crypto polyfills - resolve from mobile app's node_modules
    if (polyfillMap[moduleName]) {
        return {
            filePath: require.resolve(polyfillMap[moduleName]),
            type: 'sourceFile',
        };
    }

    // Resolve @perawallet workspace packages to source files for development
    if (moduleName === '@perawallet/wallet-core') {
        const sourcePath = path.resolve(monorepoRoot, 'packages', 'core', 'src', 'index.ts');
        try {
            require.resolve(sourcePath);
            return context.resolveRequest(context, sourcePath, platform);
        } catch {
            // Fall through to default resolution
        }
    }
    if (moduleName.startsWith('@perawallet/wallet-core-') && !moduleName.includes('devtools')) {
        const packageName = moduleName.replace('@perawallet/wallet-core-', '');
        const sourcePath = path.resolve(monorepoRoot, 'packages', packageName, 'src', 'index.ts');
        try {
            require.resolve(sourcePath);
            return context.resolveRequest(context, sourcePath, platform);
        } catch {
            // Fall through to default resolution
        }
    }

    // Force resolution of critical packages to the mobile app's node_modules
    if (moduleName === 'react' || moduleName === 'react-native' || moduleName === '@tanstack/react-query') {
        const resolvedPath = path.resolve(projectRoot, 'node_modules', moduleName);
        return context.resolveRequest(context, resolvedPath, platform);
    }

    // Chain to the standard Metro resolver
    return context.resolveRequest(context, moduleName, platform);
};

/** @type {import('expo/metro-config').MetroConfig} */
const config = {
    ...defaultConfig,
    watchFolders,
    transformer: {
        ...defaultConfig.transformer,
        babelTransformerPath: require.resolve('react-native-svg-transformer'),
    },
    resolver: {
        ...defaultConfig.resolver,
        nodeModulesPaths,
        unstable_enableSymlinks: true,
        assetExts: assetExts.filter((ext) => ext !== 'svg'),
        sourceExts: [...sourceExts, 'svg'],
        resolveRequest: customResolveRequest,
    },
};

module.exports = config;