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

import { defineConfig } from 'vitest/config'
import { coverageConfig } from '@perawallet/wallet-core-devtools/vitest/coverage'
import { poolConfig } from '@perawallet/wallet-core-devtools/vitest/pool'
import react from '@vitejs/plugin-react'
import svgr from 'vite-plugin-svgr'
import path from 'path'
import {
    type AliasEntry,
    tsconfigPathAliases,
    workspaceSourceAliases,
} from './vitest.aliases'

const monorepoRoot = path.resolve(__dirname, '../..')
const testUtil = (file: string): string =>
    path.resolve(__dirname, './src/test-utils', file)

// Hand-written redirections: each points a specifier somewhere other than its
// own source, and says why. They are listed first, so they win over the
// generated source aliases below.
const redirections: AliasEntry[] = [
    {
        // The published expo-linear-gradient build ships untransformed
        // JSX that vitest's parser can't read; swap it for a stub.
        find: 'expo-linear-gradient',
        replacement: testUtil('expo-linear-gradient-stub.tsx'),
    },
    {
        // Skia's Platform module imports `findNodeHandle` from
        // react-native, which is aliased to react-native-web below — no such
        // export, so importing Skia at all fails collection for every suite
        // that reaches a chart.
        find: '@shopify/react-native-skia',
        replacement: testUtil('skia-stub.tsx'),
    },
    {
        // victory-native draws through Skia (see above) and its
        // gestures need a real UI thread. Suites that assert on chart
        // wiring mock it themselves.
        find: 'victory-native',
        replacement: testUtil('victory-native-stub.tsx'),
    },
    {
        // react-native-keyboard-controller ships untranspiled
        // sources that vitest can't parse; tests don't need real
        // keyboard tracking, so route through a passthrough stub.
        find: 'react-native-keyboard-controller',
        replacement: testUtil('keyboard-controller-stub.tsx'),
    },
    {
        // react-native-error-boundary ships untranspiled JSX that
        // vitest can't parse; the stub mirrors its catch/resetError
        // contract so boundary specs stay behavioral.
        find: 'react-native-error-boundary',
        replacement: testUtil('error-boundary-stub.tsx'),
    },
    {
        // `@perawallet/walletconnect` (WC v1 fork) opens a relay socket on
        // construction — no good in jsdom. Route every consumer (including
        // `@perawallet/wallet-core-walletconnect`'s v1 handler) through a stub
        // class that captures `on()` handlers and `approveSession()` calls so
        // integration tests can drive the pairing flow end-to-end. The stub
        // also exports `walletConnectClientStub` for tests to inspect instances.
        find: '@perawallet/walletconnect',
        replacement: testUtil('walletconnect-client-stub.ts'),
    },
    {
        // v2's transport, same reasoning: `useConnectionsProvider`
        // registers the WalletConnect v2 handler, so every suite that
        // mounts `ConnectionsProvider` would otherwise build a real
        // WalletKit and dial the Reown relay. One stub module serves
        // both specifiers — the handler's only imports are
        // `WalletKit`, `Core` and `EXPIRER_EVENTS`.
        find: '@reown/walletkit',
        replacement: testUtil('walletkit-stub.ts'),
    },
    {
        find: '@walletconnect/core',
        replacement: testUtil('walletkit-stub.ts'),
    },
    {
        // Replace the throwing production stub with an in-memory test
        // implementation so flow tests can exercise real platform-aware
        // code paths (key-value storage, biometrics opt-in, etc.).
        find: '@perawallet/wallet-extension-platform-driver',
        replacement: testUtil('platform-driver-test.ts'),
    },
    {
        // In-memory replacement for the MMKV+AES-GCM React-Native
        // keystore. Lets `kms` run end-to-end (commit/remove/clear/
        // export) without native crypto deps.
        find: '@algorandfoundation/react-native-keystore',
        replacement: testUtil('algorand-keystore-test.ts'),
    },
    {
        // Ledger BLE/USB extensions transitively load native bluetooth
        // libraries that don't parse under jsdom. Stub at the
        // extension boundary; HW-wallet tests can override per-test.
        find: '@perawallet/wallet-extension-ledger-react-native-usb',
        replacement: testUtil('ledger-extension-stub.ts'),
    },
    {
        find: '@perawallet/wallet-extension-ledger-react-native',
        replacement: testUtil('ledger-extension-stub.ts'),
    },
]

// Pinned to this app's own copy so an import from another workspace package
// resolves to the same module instance; under pnpm those packages have no
// react-native-web of their own, and a second React breaks hooks.
const singletons: AliasEntry[] = [
    {
        find: 'react-native',
        replacement: path.resolve(__dirname, './node_modules/react-native-web'),
    },
    {
        find: 'react',
        replacement: path.resolve(__dirname, './node_modules/react'),
    },
    {
        find: 'react-dom',
        replacement: path.resolve(__dirname, './node_modules/react-dom'),
    },
    {
        find: '@tanstack/react-query',
        replacement: path.resolve(
            __dirname,
            './node_modules/@tanstack/react-query',
        ),
    },
]

// These resolve through node_modules to the package's built `dist` rather
// than to source. Moving one to source changes the code under test, so do it
// on purpose and run the full suite.
const distResolvedPackages = new Set([
    '@perawallet/wallet-core-app-integrity',
    '@perawallet/wallet-core-asa-inbox',
    '@perawallet/wallet-core-background',
    '@perawallet/wallet-core-dapp',
    '@perawallet/wallet-core-database',
    '@perawallet/wallet-core-dev-fixtures',
    '@perawallet/wallet-core-hardware-wallet',
    '@perawallet/wallet-core-migrate',
    '@perawallet/wallet-core-passkeys',
    '@perawallet/wallet-core-projects',
    '@perawallet/wallet-core-search',
    '@perawallet/wallet-extension-keystore-chrome',
    '@perawallet/wallet-extension-ledger-web-ble',
    '@perawallet/wallet-extension-ledger-web-usb',
    '@perawallet/wallet-extension-passkey-autofill',
    '@perawallet/wallet-extension-platform-chrome',
    '@perawallet/wallet-extension-platform-react-native',
])
// Same, for the root barrel only; their `/test-handlers` still come from source.
const distResolvedRoots = new Set([
    '@perawallet/wallet-core-card',
    '@perawallet/wallet-core-nfd',
])

export default defineConfig({
    plugins: [svgr(), react()],
    assetsInclude: ['**/*.svg'],
    resolve: {
        alias: [
            ...redirections,
            ...singletons,
            ...tsconfigPathAliases(path.resolve(__dirname, './tsconfig.json')),
            // Vitest-only shorthand for `src/`: Metro and Babel don't resolve it, so app code must not use it.
            { find: '@', replacement: path.resolve(__dirname, './src') },
            ...workspaceSourceAliases({
                packageRoots: [
                    path.join(monorepoRoot, 'packages'),
                    path.join(monorepoRoot, 'extensions'),
                ],
                skipPackages: new Set([
                    ...distResolvedPackages,
                    ...redirections.map(({ find }) => find),
                ]),
                skipSpecifiers: distResolvedRoots,
            }),
        ],
        extensions: [
            '.mjs',
            '.js',
            '.mts',
            '.ts',
            '.jsx',
            '.tsx',
            '.json',
            '.d.ts',
        ],
        preserveSymlinks: false,
    },
    optimizeDeps: {
        esbuildOptions: {
            loader: {
                '.js': 'jsx',
            },
        },
    },
    test: {
        // The mobile app opts out of coverage thresholds — coverage is only a
        // guard-rail for the packages/ and extensions/ tree. We still emit
        // reports when run with --coverage so the mobile numbers are visible,
        // but a below-threshold run should not fail CI.
        coverage: {
            ...coverageConfig,
            thresholds: undefined,
        },
        globals: true,
        environment: 'jsdom',
        // Known-noise warnings (react-native-web props reaching DOM
        // elements, list keys, act() nudges, i18next init) generate
        // thousands of worker→main onUserConsoleLog RPCs. Under a CI
        // coverage run the busy main process only drains that queue at run
        // end, where the stragglers race environment teardown and fail an
        // all-green run with EnvironmentTeardownError: 'Closing rpc while
        // "onUserConsoleLog" was pending'. onConsoleLog runs in the worker,
        // so dropping the noise here means those RPCs never exist. Real
        // logs and failures are unaffected.
        onConsoleLog(log: string): boolean | undefined {
            if (
                /React does not recognize the `\w+` prop on a DOM element/.test(
                    log,
                ) ||
                log.includes(
                    'Each child in a list should have a unique "key" prop',
                ) ||
                log.includes('not wrapped in act(') ||
                log.includes('You will need to pass in an i18next instance')
            ) {
                return false
            }
            return undefined
        },
        server: {
            deps: {
                inline: [/@react-navigation/],
            },
        },
        // Two projects so unit and integration tests get different setup
        // files. The integration project's setup unmocks the heavy
        // @perawallet/wallet-core-* package mocks so flow tests exercise real
        // domain code; unit tests keep the speed-oriented mocks.
        projects: [
            {
                extends: true,
                test: {
                    name: 'unit',
                    setupFiles: ['./vitest.setup.ts'],
                    // apps/browser's offscreen host is headless production
                    // code that lives with the extension shell, but its specs
                    // were written against this project's React Native mock
                    // environment (the React Native mock setup above) and need it —
                    // wallet-core packages pull native modules in transitively
                    // when their stores evaluate. Running them here is cheaper
                    // and less brittle than duplicating that environment in
                    // apps/browser, whose own vitest is deliberately minimal.
                    // `__tests__/` holds the build-config specs (app.config,
                    // production icons) and is NOT under src/. It ran on the
                    // default glob until this include was added for the browser
                    // entry above — keep it listed or those specs go unrun.
                    // `plugins/__tests__/` needs its own entry for the same
                    // reason: it is a sibling of `__tests__/`, not a child, so
                    // the config-plugin specs matched nothing and never ran.
                    include: [
                        'src/**/*.{test,spec}.{ts,tsx}',
                        '__tests__/**/*.{test,spec}.{ts,tsx}',
                        'plugins/__tests__/**/*.{test,spec}.{ts,tsx}',
                        '../browser/src/offscreen/**/*.{test,spec}.{ts,tsx}',
                    ],
                    exclude: [
                        '**/node_modules/**',
                        '**/dist/**',
                        '**/__integration__/**',
                    ],
                },
            },
            {
                extends: true,
                resolve: {
                    alias: [
                        {
                            // Node < 24 has no `crypto.argon2`, and the app gets
                            // it from react-native-quick-crypto. Flow tests that
                            // reach the cloud-backup KDF would throw without a
                            // stand-in; unit tests don't, so scope this to the
                            // integration project.
                            find: /^crypto$/,
                            replacement: path.resolve(
                                __dirname,
                                './src/test-utils/node-crypto-with-argon2.ts',
                            ),
                        },
                    ],
                },
                test: {
                    name: 'integration',
                    setupFiles: [
                        './vitest.setup.ts',
                        './vitest.integration-setup.ts',
                    ],
                    include: ['src/__integration__/**/*.{test,spec}.{ts,tsx}'],
                    // Flow tests mount real screens whose queries can still be
                    // in flight when the file ends. Routing their console output
                    // through the worker RPC makes a late log race teardown
                    // ("EnvironmentTeardownError: Closing rpc while
                    // onUserConsoleLog was pending"), failing a run in which
                    // every test passed. Logs still print, just not via RPC.
                    disableConsoleIntercept: true,
                },
            },
        ],
    },
    ...poolConfig,
})
