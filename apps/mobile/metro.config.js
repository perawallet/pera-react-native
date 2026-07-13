/*
 Copyright 2022-2026 Pera Wallet, LDA
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
// eslint-disable-next-line @typescript-eslint/no-require-imports
const fs = require('fs');

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
    ...fs
        .readdirSync(path.resolve(monorepoRoot, 'extensions'))
        .map(name => path.resolve(monorepoRoot, 'extensions', name, 'node_modules'))
        .filter(p => fs.existsSync(p)),
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
    '@utils': path.resolve(projectRoot, 'src/utils'),
};

// Crypto polyfill map
const polyfillMap = {
    // Node.js core modules (including node: prefix variants)
    'node:crypto': path.resolve(projectRoot, 'node_modules/react-native-quick-crypto'),
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

// Native modules that leak into the web bundle through shared screens get
// same-shaped no-op stubs (design spec: "ledger-react-native /
// ledger-react-native-usb / passkey-autofill → same-shaped no-op stubs").
const webStubs = {
    // BLE transport: react-native-ble-plx calls NativeModules.BlePlx at eval time.
    '@perawallet/wallet-extension-ledger-react-native': 'web-shims/ledger-react-native.js',
    // USB HID transport: @ledgerhq/react-native-hid requires the native bridge.
    '@perawallet/wallet-extension-ledger-react-native-usb': 'web-shims/ledger-react-native-usb.js',
    // Native credential provider: requireNativeModule('ReactNativePasskeyAutofill') throws on web.
    '@algorandfoundation/react-native-passkey-autofill': 'web-shims/react-native-passkey-autofill.js',
    // Worklets runtime: installWorkletsSupport() calls react-native's NativeModules bridge at eval.
    // On web, react-native-reanimated uses CSS animations and does not require the worklet runtime.
    'react-native-worklets': 'web-shims/react-native-worklets.js',
    // Nitro Modules: index.ts calls installWorkletsSupport() at eval time which transitively
    // requires BatchedBridge (NativeModules) and throws __fbBatchedBridgeConfig on web.
    // Hybrid objects are native-only; the shim exposes a safe stub for web.
    'react-native-nitro-modules': 'web-shims/react-native-nitro-modules.js',
};

// Custom resolver function
const customResolveRequest = (context, moduleName, platform) => {
    // Strip Vite ?raw suffix so Metro can find the actual file
    if (moduleName.endsWith('?raw')) {
        const cleanName = moduleName.slice(0, -4);
        return context.resolveRequest(context, cleanName, platform);
    }

    // Handle path aliases
    for (const [alias, aliasPath] of Object.entries(aliasMap)) {
        if (moduleName.startsWith(alias + '/')) {
            const modulePath = moduleName.substring(alias.length + 1);
            const fullPath = path.join(aliasPath, modulePath);
            return context.resolveRequest(context, fullPath, platform);
        }
    }

    // Resolve @algorandfoundation/algokit-utils/algo25 subpath to its actual directory
    if (moduleName === '@algorandfoundation/algokit-utils/algo25') {
        const pkgPath = path.dirname(require.resolve('@algorandfoundation/algokit-utils/package.json'));
        return context.resolveRequest(context, path.resolve(pkgPath, 'algo25'), platform);
    }

    // Handle crypto polyfills - resolve from mobile app's node_modules
    // (native only: web resolves packages' own browser builds instead)
    if (platform !== 'web' && polyfillMap[moduleName]) {
        return {
            filePath: require.resolve(polyfillMap[moduleName]),
            type: 'sourceFile',
        };
    }

    // Web shim: react-native-quick-base64 calls TurboModuleRegistry which is
    // unavailable in browser environments — redirect to the pure-JS web shim.
    if (platform === 'web' && moduleName === 'react-native-quick-base64') {
        return {
            filePath: path.resolve(projectRoot, 'web-shims/react-native-quick-base64.js'),
            type: 'sourceFile',
        };
    }

    // Web shim: 'crypto', 'node:crypto', and 'react-native-quick-crypto' all
    // resolve to the node-crypto.js shim on web. The babel-plugin-module-resolver
    // in babel.config.js rewrites `import ... from 'crypto'` → 'react-native-quick-crypto'
    // at compile time (before Metro's resolveRequest sees it), so we must intercept
    // the renamed specifier too. On web, the browser's SubtleCrypto API + @noble/hashes
    // replace the native bridge implementation without touching the native bridge.
    if (
        platform === 'web' && (
            moduleName === 'node:crypto' ||
            moduleName === 'crypto' ||
            moduleName === 'react-native-quick-crypto'
        )
    ) {
        return {
            filePath: path.resolve(projectRoot, 'web-shims/node-crypto.js'),
            type: 'sourceFile',
        };
    }

    // Web stub map: native modules that have no browser equivalent get
    // same-shaped no-op shims so Metro can bundle the onboarding graph on web.
    if (platform === 'web' && webStubs[moduleName]) {
        return {
            filePath: path.resolve(projectRoot, webStubs[moduleName]),
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
    // Web builds swap the RN keystore for the chrome implementation with the
    // same export surface (extensions/keystore-chrome). Native keeps the real
    // react-native-keystore (Keychain + MMKV).
    if (
        platform === 'web' &&
        moduleName === '@algorandfoundation/react-native-keystore'
    ) {
        const sourcePath = path.resolve(
            monorepoRoot,
            'extensions',
            'keystore-chrome',
            'src',
            'index.ts',
        );
        return context.resolveRequest(context, sourcePath, platform);
    }
    // Subpath: App.web.tsx statically imports only the storage bootstrap to avoid
    // pulling @algorandfoundation/keystore (and its native-bridge-touching deps)
    // into the main synchronous bundle. The /bootstrap subpath is safe: it only
    // re-exports hydrateKeystoreStorage which uses chrome.storage.local.
    // Native keeps the real react-native-keystore, so this subpath must only
    // resolve on web (same guard as every sibling branch above).
    if (
        platform === 'web' &&
        moduleName === '@perawallet/wallet-extension-keystore-chrome/bootstrap'
    ) {
        const sourcePath = path.resolve(
            monorepoRoot,
            'extensions',
            'keystore-chrome',
            'src',
            'bootstrap.ts',
        );
        return context.resolveRequest(context, sourcePath, platform);
    }
    if (moduleName === '@perawallet/wallet-extension-platform-driver') {
        const driverPackage =
            platform === 'web' ? 'platform-chrome' : 'platform-react-native';
        const sourcePath = path.resolve(
            monorepoRoot, 'extensions', driverPackage, 'src', 'index.ts',
        );
        return context.resolveRequest(context, sourcePath, platform);
    }
    if (moduleName.startsWith('@perawallet/wallet-extension-')) {
        const packageName = moduleName.replace('@perawallet/wallet-extension-', '');
        // Skip subpath imports — let Metro's default resolver handle them
        if (!packageName.includes('/')) {
            const sourcePath = path.resolve(monorepoRoot, 'extensions', packageName, 'src', 'index.ts');
            try {
                require.resolve(sourcePath);
                return context.resolveRequest(context, sourcePath, platform);
            } catch {
                // Fall through to default resolution
            }
        }
    }

    // Force resolution of critical packages to the mobile app's node_modules
    const forceResolveModules =
        platform === 'web'
            ? ['react', 'react-dom', '@tanstack/react-query']
            : [
                  'react',
                  'react-native',
                  'react-native-nitro-modules',
                  '@tanstack/react-query',
                  'react-dom',
                  '@react-native-community/datetimepicker',
              ];
    if (forceResolveModules.includes(moduleName)) {
        const resolvedPath = path.resolve(projectRoot, 'node_modules', moduleName);
        return context.resolveRequest(context, resolvedPath, platform);
    }

    // Chain to the standard Metro resolver
    try {
        return context.resolveRequest(context, moduleName, platform);
    } catch (error) {
        // Fix for @noble/hashes exports issue - Metro sometimes appends .js to subpaths
        // that are only exported without the extension in package.json
        if (moduleName.includes('@noble/hashes') && moduleName.endsWith('.js')) {
            const fixedModuleName = moduleName.substring(0, moduleName.length - 3);
            try {
                return context.resolveRequest(context, fixedModuleName, platform);
            } catch {
                // If it still fails, throw original error
            }
        }
        throw error;
    }
};

/** @type {import('expo/metro-config').MetroConfig} */
const config = {
    ...defaultConfig,
    watchFolders,
    transformer: {
        ...defaultConfig.transformer,
        babelTransformerPath: require.resolve('./metro-raw-transformer.js'),
    },
    resolver: {
        ...defaultConfig.resolver,
        nodeModulesPaths,
        assetExts: assetExts.filter((ext) => ext !== 'svg'),
        sourceExts: [...sourceExts, 'svg', 'sql'],
        // Honor the `import` (and `require`) export conditions. Several
        // @algorandfoundation packages (e.g. react-native-keystore) ship an
        // `exports` map with only an `import` condition — no `default`/
        // `react-native` fallback — so with package-exports enabled Metro's
        // default iOS/Android conditions ([react-native, default]) match
        // nothing and the module fails to resolve ("could not be found").
        // Adding these conditions lets Metro resolve those entries. It's
        // additive: packages that expose react-native/default still match those
        // first (exports matching is keyed by the package's own condition order).
        unstable_conditionNames: ['require', 'import'],
        resolveRequest: customResolveRequest,
    },
};

module.exports = config;