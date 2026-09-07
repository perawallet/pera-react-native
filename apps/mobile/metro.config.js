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
// Web-only platform shims live with the extension build they belong to
// (apps/browser), not comingled in the mobile app tree. Metro resolves them
// from here for the web bundle; `.web.tsx` component variants stay colocated
// with their native siblings under src/.
const webShimsRoot = path.resolve(projectRoot, '../browser/web-shims');

const defaultConfig = getDefaultConfig(projectRoot);

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

const aliasMap = {
    '@components': path.resolve(projectRoot, 'src/components'),
    '@providers': path.resolve(projectRoot, 'src/providers'),
    '@routes': path.resolve(projectRoot, 'src/routes'),
    '@hooks': path.resolve(projectRoot, 'src/hooks'),
    '@i18n': path.resolve(projectRoot, 'src/i18n'),
    '@constants': path.resolve(projectRoot, 'src/constants'),
    '@modules': path.resolve(projectRoot, 'src/modules'),
    '@assets': path.resolve(projectRoot, 'assets'),
    '@theme': path.resolve(projectRoot, 'src/theme'),
    '@layouts': path.resolve(projectRoot, 'src/layouts'),
    '@utils': path.resolve(projectRoot, 'src/utils'),
    // Web-only application code that lives with the extension shell rather
    // than in the RN app (the offscreen document's headless hosts). Only ever
    // resolved on platform === 'web' — a native bundle never imports it.
    '@browser': path.resolve(projectRoot, '../browser/src'),
};

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
// same-shaped no-op stubs. (Ledger's native transports are handled instead
// by pera-provider.web.ts importing the real Web Bluetooth/WebHID packages
// directly — see extensions/provider/src/pera-provider.web.ts.)
const webStubs = {
    // Native credential provider: requireNativeModule('ReactNativePasskeyAutofill') throws on web.
    '@algorandfoundation/react-native-passkey-autofill': 'react-native-passkey-autofill.js',
    // Worklets runtime: installWorkletsSupport() calls react-native's NativeModules bridge at eval.
    // On web, react-native-reanimated uses CSS animations and does not require the worklet runtime.
    'react-native-worklets': 'react-native-worklets.js',
    // Nitro Modules: index.ts calls installWorkletsSupport() at eval time which transitively
    // requires BatchedBridge (NativeModules) and throws __fbBatchedBridgeConfig on web.
    // Hybrid objects are native-only; the shim exposes a safe stub for web.
    'react-native-nitro-modules': 'react-native-nitro-modules.js',
    // Share sheet: react-native-share calls TurboModuleRegistry.getEnforcing('RNShare')
    // at module-eval time (undefined.getEnforcing on web). Pulled in transitively by
    // the Home/Contacts screen graphs (@utils/shareText, @utils/shareCsvFile). The
    // shim prefers the real Web Share API and otherwise throws a clear error.
    'react-native-share': 'react-native-share.js',
    // Push notifications: @notifee/react-native constructs its native module class
    // at eval time, touching the legacy NativeModules bridge and throwing
    // "__fbBatchedBridgeConfig is not set" on web. pushNotificationSettings is
    // capability-gated off on web (routes/capabilities.web.ts); this stub only
    // needs to satisfy useSystemNotificationPermission.ts without crashing.
    '@notifee/react-native': 'notifee-react-native.js',
    // Lists: @shopify/flash-list v2 renders a Fabric-only AutoLayoutView native
    // component and touches the legacy NativeModules bridge at import time
    // ("__fbBatchedBridgeConfig is not set" on web — no web target exists for
    // FlashList v2). PWFlatList (core/@components) is the only runtime
    // consumer; the shim is a real FlatList-backed list, not an inert no-op.
    '@shopify/flash-list': 'flash-list.js',
    // Carousels: react-native-pager-view requires the native RNCViewPager view
    // manager and touches the legacy NativeModules bridge at import time
    // ("__fbBatchedBridgeConfig is not set" on web — no web build exists).
    // Was pulled in transitively by @modules/banners' barrel (BannerCarousel /
    // SpotBannerCarousel) even when only HomeBannersStrip was imported — that
    // barrel (modules/banners/index.ts) was later split so the carousel
    // pieces are no longer in the module's main entry; the shim stays because
    // MediaCarousel/FullScreenMediaViewer/SpotBannerCarousel/OnrampScreen
    // still import react-native-pager-view directly. The shim is
    // a real horizontal paging ScrollView, not an inert no-op.
    'react-native-pager-view': 'react-native-pager-view.js',
    // Store rating: react-native-rate-app calls TurboModuleRegistry.getEnforcing
    // ('RateApp') at module-eval time (undefined.getEnforcing on web). Pulled in
    // by useSettingsScreen.tsx's static top-level import of RatingsContent
    // (Settings tab is mounted on web), even though storeRating is
    // capability-gated off on web (routes/capabilities.web.ts) — the "Rate the
    // app" option itself never renders, but the module import isn't gated.
    'react-native-rate-app': 'react-native-rate-app.js',
    // In-app webview: react-native-webview's own web-fallback module has a
    // broken interopRequireDefault dependency that throws "t is not a
    // function" at eval time, killing the whole web bundle
    // (ModelViewerBottomSheet and PWWebView statically import it, and
    // widened static Swap/Onramp/Staking imports now pull that graph in
    // unconditionally). PWWebView's surfaces are off-capability, and the
    // collectible 3D-model viewer is gated off `inAppWebView` on web too,
    // so the shim only needs to survive eval; it throws clearly if ever
    // rendered.
    'react-native-webview': 'react-native-webview.js',
    // Quantum (PQ) signing: falcon-1024's Emscripten-generated dist/index.js
    // fails to parse under Metro's web bundler at all (not just at eval
    // time). Only reachable via wasmFalconProvider.ts (off-device provider),
    // and quantum accounts are capability-gated off on web (routeCapabilities
    // .quantum) since there is no working signer path here yet — the shim
    // only needs to survive bundling; it throws clearly if ever invoked.
    'falcon-1024': 'falcon-1024.js',
};

// Locale tour (i18n screenshot QA) is swapped for no-op stubs in any build
// that is not a dev build. Resolution-time, not runtime: a `config.*` read
// would ship the tour's navigation-driving code into release bundles, which
// Metro can only strip when the gate is statically known here.
//
// Fail-safe by construction: `NODE_ENV` must EQUAL 'development'. Expo CLI
// sets that for `expo start`; `expo export:embed` sets 'production' and vitest
// sets 'test', so undefined and everything else falls through to stubbed. Do
// not loosen this to `!== 'production'`.
const localeTourEnabled = process.env.NODE_ENV === 'development';

// Keyed by resolved absolute path, not by specifier: the swap has to hold for
// the alias form (`@modules/locale-tour`), a relative import of the same file,
// and a bare directory import that lands on index.ts. Matching after
// resolution covers all three; matching specifiers would need one rule each
// and silently miss the next one someone writes.
const localeTourStubs = Object.fromEntries(
    [
        // The load-bearing one. register.ts is the tour driver's only importer
        // (App.tsx pulls it in for effect), so stubbing it is what detaches
        // runTour/runTourStep/steps from the graph. The deeplink handler
        // reaches the driver through locale-tour/registry.ts instead, which
        // imports nothing — see that file for the cycle this avoids.
        'src/modules/locale-tour/register',
        // Backstop for anything that reaches the barrel directly. The gallery
        // catalog steps.ts reads is NOT detached by any of this: it already
        // ships in release via the developer settings screens.
        'src/modules/locale-tour/index',
        // Overflow instrumentation, called from PWText on every render.
        'src/modules/locale-tour/hooks/useOverflowProbe',
        // Deeplink parse boundary: the stub returns null, so the tour URL
        // falls through to a harmless HOME like any unrecognized path.
        'src/hooks/deeplink/dev-locale-tour-parser',
        // Deeplink dispatch. Belt-and-braces since the registry inversion: it
        // no longer imports the driver, and with register.ts stubbed it would
        // find no runner and no-op anyway.
        'src/hooks/deeplink/handlers/useLocaleTourDeeplink',
        // Pseudolocale bundle (~180 KB generated from `en`).
        'src/i18n/pseudoResources',
    ].map(modulePath => [
        path.resolve(projectRoot, `${modulePath}.ts`),
        path.resolve(projectRoot, `${modulePath}.stub.ts`),
    ]),
);

console.log(
    `[metro] locale tour: ${localeTourEnabled ? 'enabled' : 'stubbed'} (NODE_ENV=${process.env.NODE_ENV ?? 'unset'})`,
);

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
            filePath: path.resolve(webShimsRoot, 'react-native-quick-base64.js'),
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
            filePath: path.resolve(webShimsRoot, 'node-crypto.js'),
            type: 'sourceFile',
        };
    }

    // Web stub map: native modules that have no browser equivalent get
    // same-shaped no-op shims so Metro can bundle the onboarding graph on web.
    if (platform === 'web' && webStubs[moduleName]) {
        return {
            filePath: path.resolve(webShimsRoot, webStubs[moduleName]),
            type: 'sourceFile',
        };
    }

    // Resolve @perawallet workspace packages to source files for development.
    // Convenience only — every package's dist must be correct on its own. This
    // used to also be what kept quantum accounts on the native Falcon provider,
    // since kms's dist carried only the WASM one; kms now ships a second bundle
    // behind a `react-native` export condition, held by
    // tools/check-kms-pq-dist.mjs.
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
        const rest = moduleName.replace('@perawallet/wallet-core-', '');
        const [packageName, ...subpathParts] = rest.split('/');
        const subpath = subpathParts.join('/');
        // A subpath export can be backed by either a flat file (src/webauthn.ts)
        // or a directory barrel (src/queue/index.ts) — try both shapes.
        const candidatePaths = subpath
            ? [
                  path.resolve(monorepoRoot, 'packages', packageName, 'src', `${subpath}.ts`),
                  path.resolve(monorepoRoot, 'packages', packageName, 'src', subpath, 'index.ts'),
              ]
            : [path.resolve(monorepoRoot, 'packages', packageName, 'src', 'index.ts')];
        for (const sourcePath of candidatePaths) {
            try {
                require.resolve(sourcePath);
                return context.resolveRequest(context, sourcePath, platform);
            } catch {
                // Try the next candidate shape / fall through to default resolution
            }
        }
    }
    // Web builds swap the RN keystore for the chrome implementation
    // (extensions/keystore-chrome). Native keeps the real
    // react-native-keystore (Keychain + MMKV).
    //
    // This alias no longer covers key storage. The two surfaces stopped being
    // equivalent when the app moved to canary.14 — the port implements
    // canary.12 and has no engine factory — so the web build gets its engine
    // from @algorandfoundation/keystore-web instead, via the `.web.ts` files
    // beside extensions/provider's createKeystore and keystore/maintenance.
    // What still resolves here is everything the extension owns and the RN
    // package happens to share a name with: the password vault, auto-lock,
    // passkey unlock and the WebAuthn signer.
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
    // Subpath: App.web.tsx statically imports only the platform-chrome
    // bootstrap (getSurface/hydratePlatform/installOffscreenStorageShim) to
    // avoid pulling ChromeDatabaseService (drizzle-orm) and the
    // hardware-wallet registry into the pre-hydration web bundle. Native
    // keeps the real react-native platform driver, so this subpath must only
    // resolve on web (same guard as the keystore-chrome/bootstrap branch
    // above).
    if (
        platform === 'web' &&
        moduleName === '@perawallet/wallet-extension-platform-chrome/bootstrap'
    ) {
        const sourcePath = path.resolve(
            monorepoRoot,
            'extensions',
            'platform-chrome',
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
        const rest = moduleName.replace('@perawallet/wallet-extension-', '');
        const [packageName, ...subpathParts] = rest.split('/');
        const subpath = subpathParts.join('/');
        // A subpath export can be backed by either a flat file (src/protocol.ts)
        // or a directory barrel (src/subdir/index.ts) — try both shapes.
        const candidatePaths = subpath
            ? [
                  path.resolve(monorepoRoot, 'extensions', packageName, 'src', `${subpath}.ts`),
                  path.resolve(monorepoRoot, 'extensions', packageName, 'src', subpath, 'index.ts'),
              ]
            : [path.resolve(monorepoRoot, 'extensions', packageName, 'src', 'index.ts')];
        for (const sourcePath of candidatePaths) {
            try {
                require.resolve(sourcePath);
                return context.resolveRequest(context, sourcePath, platform);
            } catch {
                // Try the next candidate shape / fall through to default resolution
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

    // falcon-1024 ships a dual build whose ESM entry (dist/index.js)
    // instantiates its WASM with a module-level `await`. hermesc rejects
    // top-level await in release bundles, so the release build dies at
    // createBundleReleaseJsAndAssets. Because this package lists the `import`
    // condition before `require` and we enable both (see
    // unstable_conditionNames above), Metro picks the ESM entry. Redirect to
    // the sibling CJS build — identical API, no top-level await — by resolving
    // normally and swapping the resolved entry file.
    if (moduleName === 'falcon-1024') {
        const resolved = context.resolveRequest(context, moduleName, platform);
        if (
            resolved?.type === 'sourceFile' &&
            /[\\/]dist[\\/]index\.js$/.test(resolved.filePath)
        ) {
            return {
                type: 'sourceFile',
                filePath: resolved.filePath.replace(/index\.js$/, 'index.cjs'),
            };
        }
        return resolved;
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

// Wraps the resolver rather than living inside it: every early `return` above
// is a path the swap would otherwise miss, and several of them (the alias
// branch in particular) re-enter Metro's own resolver, not this one.
const resolveRequest = (context, moduleName, platform) => {
    const resolved = customResolveRequest(context, moduleName, platform);
    if (localeTourEnabled || resolved?.type !== 'sourceFile') return resolved;
    const stub = localeTourStubs[resolved.filePath];
    return stub ? { type: 'sourceFile', filePath: stub } : resolved;
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
        resolveRequest,
    },
};

module.exports = config;