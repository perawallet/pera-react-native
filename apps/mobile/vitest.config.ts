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

export default defineConfig({
    plugins: [svgr(), react()],
    assetsInclude: ['**/*.svg'],
    resolve: {
        alias: [
            {
                find: 'react-native',
                // Absolute path so the alias resolves identically when the
                // import originates from another workspace package — those
                // packages don't have react-native-web in their own
                // node_modules under pnpm.
                replacement: path.resolve(
                    __dirname,
                    './node_modules/react-native-web',
                ),
            },
            {
                // The published expo-linear-gradient build ships untransformed
                // JSX that vitest's parser can't read; swap it for a stub.
                find: 'expo-linear-gradient',
                replacement: path.resolve(
                    __dirname,
                    './src/test-utils/expo-linear-gradient-stub.tsx',
                ),
            },
            {
                // react-native-keyboard-controller ships untranspiled
                // sources that vitest can't parse; tests don't need real
                // keyboard tracking, so route through a passthrough stub.
                find: 'react-native-keyboard-controller',
                replacement: path.resolve(
                    __dirname,
                    './src/test-utils/keyboard-controller-stub.tsx',
                ),
            },
            {
                // react-native-error-boundary ships untranspiled JSX that
                // vitest can't parse; the stub mirrors its catch/resetError
                // contract so boundary specs stay behavioral.
                find: 'react-native-error-boundary',
                replacement: path.resolve(
                    __dirname,
                    './src/test-utils/error-boundary-stub.tsx',
                ),
            },
            {
                // @expensify/react-native-wallet resolves its TurboModule and
                // constructs a NativeEventEmitter at import time — neither
                // exists in jsdom. The stub answers "wallet unavailable" so
                // suites exercise the manual-instructions fallback.
                find: '@expensify/react-native-wallet',
                replacement: path.resolve(
                    __dirname,
                    './src/test-utils/react-native-wallet-stub.ts',
                ),
            },
            {
                // `@perawallet/walletconnect` (WC v1 fork) opens a relay
                // socket on construction — no good in jsdom. Route every
                // consumer (including the deep
                // `@perawallet/wallet-core-walletconnect` hooks) through a
                // stub class that captures `on()` handlers and
                // `approveSession()` calls so integration tests can drive the
                // pairing flow end-to-end. The stub also exports
                // `walletConnectClientStub` for tests to inspect instances.
                find: '@perawallet/walletconnect',
                replacement: path.resolve(
                    __dirname,
                    './src/test-utils/walletconnect-client-stub.ts',
                ),
            },
            {
                find: 'react',
                replacement: path.resolve(__dirname, './node_modules/react'),
            },
            {
                find: 'react-dom',
                replacement: path.resolve(
                    __dirname,
                    './node_modules/react-dom',
                ),
            },
            {
                find: '@components',
                replacement: path.resolve(__dirname, './src/components'),
            },
            {
                find: '@modules',
                replacement: path.resolve(__dirname, './src/modules'),
            },
            {
                find: '@hooks',
                replacement: path.resolve(__dirname, './src/hooks'),
            },
            {
                find: '@i18n',
                replacement: path.resolve(__dirname, './src/i18n'),
            },
            {
                find: '@analytics',
                replacement: path.resolve(__dirname, './src/analytics'),
            },
            {
                find: '@constants',
                replacement: path.resolve(__dirname, './src/constants'),
            },
            {
                find: '@theme',
                replacement: path.resolve(__dirname, './src/theme'),
            },
            {
                find: '@providers',
                replacement: path.resolve(__dirname, './src/providers'),
            },
            {
                find: '@routes',
                replacement: path.resolve(__dirname, './src/routes'),
            },
            {
                find: '@assets',
                replacement: path.resolve(__dirname, './assets'),
            },
            {
                find: '@layouts',
                replacement: path.resolve(__dirname, './src/layouts'),
            },
            {
                find: '@test-utils',
                replacement: path.resolve(__dirname, './src/test-utils'),
            },
            {
                find: '@utils',
                replacement: path.resolve(__dirname, './src/utils'),
            },
            { find: '@', replacement: path.resolve(__dirname, './src') },
            {
                // The `/test-utils` sub-export is consumed by msw-handlers
                // files across packages (validateMockResponse / -Request).
                // Aliased to source so changes don't require rebuilding the
                // shared package's dist between iterations.
                find: '@perawallet/wallet-core-shared/test-utils',
                replacement: path.resolve(
                    __dirname,
                    '../../packages/shared/src/test-utils/index.ts',
                ),
            },
            {
                find: '@perawallet/wallet-core-shared/test-handlers',
                replacement: path.resolve(
                    __dirname,
                    '../../packages/shared/src/test-handlers.ts',
                ),
            },
            {
                find: '@perawallet/wallet-core-shared/queue',
                replacement: path.resolve(
                    __dirname,
                    '../../packages/shared/src/queue/index.ts',
                ),
            },
            {
                find: '@perawallet/wallet-core-shared',
                replacement: path.resolve(
                    __dirname,
                    '../../packages/shared/src/index.ts',
                ),
            },
            {
                // Replace the throwing production stub with an in-memory test
                // implementation so flow tests can exercise real platform-aware
                // code paths (key-value storage, biometrics opt-in, etc.).
                // See apps/mobile/src/test-utils/platform-driver-test.ts.
                find: '@perawallet/wallet-extension-platform-driver',
                replacement: path.resolve(
                    __dirname,
                    './src/test-utils/platform-driver-test.ts',
                ),
            },
            {
                // In-memory replacement for the MMKV+AES-GCM React-Native
                // keystore. Lets `kms` run end-to-end (commit/remove/clear/
                // export) without native crypto deps.
                // See apps/mobile/src/test-utils/algorand-keystore-test.ts.
                find: '@algorandfoundation/react-native-keystore',
                replacement: path.resolve(
                    __dirname,
                    './src/test-utils/algorand-keystore-test.ts',
                ),
            },
            {
                // Ledger BLE/USB extensions transitively load native bluetooth
                // libraries that don't parse under jsdom. Stub at the
                // extension boundary; HW-wallet tests can override per-test.
                find: '@perawallet/wallet-extension-ledger-react-native-usb',
                replacement: path.resolve(
                    __dirname,
                    './src/test-utils/ledger-extension-stub.ts',
                ),
            },
            {
                // Platform-agnostic types/errors/constants, now its own
                // package (it has no react-native dependency, and the two web
                // transports were reaching it through a package named
                // "react-native"). Safe to alias straight to source. MUST come
                // before the ledger-react-native alias below so prefix
                // matching doesn't shadow it.
                find: '@perawallet/wallet-extension-ledger-shared',
                replacement: path.resolve(
                    __dirname,
                    '../../extensions/ledger-shared/src/index.ts',
                ),
            },
            {
                find: '@perawallet/wallet-extension-ledger-react-native',
                replacement: path.resolve(
                    __dirname,
                    './src/test-utils/ledger-extension-stub.ts',
                ),
            },
            {
                find: '@perawallet/wallet-extension-provider',
                replacement: path.resolve(
                    __dirname,
                    '../../extensions/provider/src/index.ts',
                ),
            },
            {
                find: '@perawallet/wallet-extension-platform',
                replacement: path.resolve(
                    __dirname,
                    '../../extensions/platform/src/index.ts',
                ),
            },
            {
                find: '@perawallet/wallet-core-age-gate',
                replacement: path.resolve(
                    __dirname,
                    '../../packages/age-gate/src/index.ts',
                ),
            },
            {
                find: '@perawallet/wallet-core-analytics',
                replacement: path.resolve(
                    __dirname,
                    '../../packages/analytics/src/index.ts',
                ),
            },
            {
                find: '@perawallet/wallet-core-nfd/test-handlers',
                replacement: path.resolve(
                    __dirname,
                    '../../packages/nfd/src/test-handlers.ts',
                ),
            },
            {
                find: '@perawallet/wallet-core-accounts/test-handlers',
                replacement: path.resolve(
                    __dirname,
                    '../../packages/accounts/src/test-handlers.ts',
                ),
            },
            {
                find: '@perawallet/wallet-core-accounts',
                replacement: path.resolve(
                    __dirname,
                    '../../packages/accounts/src/index.ts',
                ),
            },
            {
                find: '@perawallet/wallet-core-card/test-handlers',
                replacement: path.resolve(
                    __dirname,
                    '../../packages/card/src/test-handlers.ts',
                ),
            },
            {
                find: '@perawallet/wallet-core-backup',
                replacement: path.resolve(
                    __dirname,
                    '../../packages/backup/src/index.ts',
                ),
            },
            {
                find: '@perawallet/wallet-core-assets/test-handlers',
                replacement: path.resolve(
                    __dirname,
                    '../../packages/assets/src/test-handlers.ts',
                ),
            },
            {
                find: '@perawallet/wallet-core-assets',
                replacement: path.resolve(
                    __dirname,
                    '../../packages/assets/src/index.ts',
                ),
            },
            {
                find: '@perawallet/wallet-core-blockchain/test-handlers',
                replacement: path.resolve(
                    __dirname,
                    '../../packages/blockchain/src/test-handlers.ts',
                ),
            },
            {
                find: '@perawallet/wallet-core-blockchain',
                replacement: path.resolve(
                    __dirname,
                    '../../packages/blockchain/src/index.ts',
                ),
            },
            {
                find: '@perawallet/wallet-core-config',
                replacement: path.resolve(
                    __dirname,
                    '../../packages/config/src/index.ts',
                ),
            },
            {
                // More specific deep-import alias must come BEFORE the
                // package's main alias so prefix matching doesn't shadow it.
                find: '@perawallet/wallet-core-currencies/test-handlers',
                replacement: path.resolve(
                    __dirname,
                    '../../packages/currencies/src/test-handlers.ts',
                ),
            },
            {
                find: '@perawallet/wallet-core-currencies',
                replacement: path.resolve(
                    __dirname,
                    '../../packages/currencies/src/index.ts',
                ),
            },
            {
                find: '@perawallet/wallet-core-contacts',
                replacement: path.resolve(
                    __dirname,
                    '../../packages/contacts/src/index.ts',
                ),
            },
            {
                find: '@perawallet/wallet-core-walletconnect',
                replacement: path.resolve(
                    __dirname,
                    '../../packages/walletconnect/src/index.ts',
                ),
            },
            {
                find: '@perawallet/wallet-core-settings',
                replacement: path.resolve(
                    __dirname,
                    '../../packages/settings/src/index.ts',
                ),
            },
            {
                find: '@perawallet/wallet-core-kms',
                replacement: path.resolve(
                    __dirname,
                    '../../packages/kms/src/index.ts',
                ),
            },
            {
                find: '@perawallet/wallet-core-transactions/test-handlers',
                replacement: path.resolve(
                    __dirname,
                    '../../packages/transactions/src/test-handlers.ts',
                ),
            },
            {
                find: '@perawallet/wallet-core-transactions',
                replacement: path.resolve(
                    __dirname,
                    '../../packages/transactions/src/index.ts',
                ),
            },
            {
                find: '@perawallet/wallet-core-onramp/test-handlers',
                replacement: path.resolve(
                    __dirname,
                    '../../packages/onramp/src/test-handlers.ts',
                ),
            },
            {
                find: '@perawallet/wallet-core-onramp',
                replacement: path.resolve(
                    __dirname,
                    '../../packages/onramp/src/index.ts',
                ),
            },
            {
                find: '@perawallet/wallet-core-fee-delegation/test-handlers',
                replacement: path.resolve(
                    __dirname,
                    '../../packages/fee-delegation/src/test-handlers.ts',
                ),
            },
            {
                find: '@perawallet/wallet-core-fee-delegation',
                replacement: path.resolve(
                    __dirname,
                    '../../packages/fee-delegation/src/index.ts',
                ),
            },
            {
                find: '@perawallet/wallet-core-swaps/test-handlers',
                replacement: path.resolve(
                    __dirname,
                    '../../packages/swaps/src/test-handlers.ts',
                ),
            },
            {
                find: '@perawallet/wallet-core-swaps',
                replacement: path.resolve(
                    __dirname,
                    '../../packages/swaps/src/index.ts',
                ),
            },
            {
                find: '@perawallet/wallet-core-polling/test-handlers',
                replacement: path.resolve(
                    __dirname,
                    '../../packages/polling/src/test-handlers.ts',
                ),
            },
            {
                find: '@perawallet/wallet-core-polling',
                replacement: path.resolve(
                    __dirname,
                    '../../packages/polling/src/index.ts',
                ),
            },
            {
                find: '@perawallet/wallet-core-devtools',
                replacement: path.resolve(
                    __dirname,
                    '../../packages/devtools/src/index.ts',
                ),
            },
            {
                find: '@perawallet/wallet-core-signing',
                replacement: path.resolve(
                    __dirname,
                    '../../packages/signing/src/index.ts',
                ),
            },
            {
                find: '@perawallet/wallet-core-ledger',
                replacement: path.resolve(
                    __dirname,
                    '../../packages/ledger/src/index.ts',
                ),
            },
            {
                find: '@perawallet/wallet-core-security',
                replacement: path.resolve(
                    __dirname,
                    '../../packages/security/src/index.ts',
                ),
            },
            {
                find: '@perawallet/wallet-core-messages/test-handlers',
                replacement: path.resolve(
                    __dirname,
                    '../../packages/messages/src/test-handlers.ts',
                ),
            },
            {
                find: '@perawallet/wallet-core-messages',
                replacement: path.resolve(
                    __dirname,
                    '../../packages/messages/src/index.ts',
                ),
            },
            {
                find: '@perawallet/wallet-core-multisig/test-handlers',
                replacement: path.resolve(
                    __dirname,
                    '../../packages/multisig/src/test-handlers.ts',
                ),
            },
            {
                find: '@perawallet/wallet-core-multisig',
                replacement: path.resolve(
                    __dirname,
                    '../../packages/multisig/src/index.ts',
                ),
            },
            {
                find: '@perawallet/wallet-core-device/test-handlers',
                replacement: path.resolve(
                    __dirname,
                    '../../packages/device/src/test-handlers.ts',
                ),
            },
            {
                find: '@perawallet/wallet-core-device',
                replacement: path.resolve(
                    __dirname,
                    '../../packages/device/src/index.ts',
                ),
            },
            {
                find: '@perawallet/wallet-core-banners/test-handlers',
                replacement: path.resolve(
                    __dirname,
                    '../../packages/banners/src/test-handlers.ts',
                ),
            },
            {
                find: '@perawallet/wallet-core-banners',
                replacement: path.resolve(
                    __dirname,
                    '../../packages/banners/src/index.ts',
                ),
            },
            {
                find: '@perawallet/wallet-core-remote-config',
                replacement: path.resolve(
                    __dirname,
                    '../../packages/remote-config/src/index.ts',
                ),
            },
            {
                find: '@perawallet/wallet-core-staking/test-handlers',
                replacement: path.resolve(
                    __dirname,
                    '../../packages/staking/src/test-handlers.ts',
                ),
            },
            {
                find: '@perawallet/wallet-core-staking',
                replacement: path.resolve(
                    __dirname,
                    '../../packages/staking/src/index.ts',
                ),
            },
            {
                find: '@perawallet/wallet-core-notifications',
                replacement: path.resolve(
                    __dirname,
                    '../../packages/notifications/src/index.ts',
                ),
            },
            {
                find: '@tanstack/react-query',
                replacement: path.resolve(
                    __dirname,
                    './node_modules/@tanstack/react-query',
                ),
            },
            {
                find: '@tanstack/query-core',
                replacement: path.resolve(
                    __dirname,
                    './node_modules/@tanstack/query-core',
                ),
            },
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
                inline: [/@react-navigation/, /react-native-ratings/],
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
                    // environment (the ~2300-line setup above) and need it —
                    // wallet-core packages pull native modules in transitively
                    // when their stores evaluate. Running them here is cheaper
                    // and less brittle than duplicating that environment in
                    // apps/browser, whose own vitest is deliberately minimal.
                    // `__tests__/` holds the build-config specs (app.config,
                    // production icons) and is NOT under src/. It ran on the
                    // default glob until this include was added for the browser
                    // entry above — keep it listed or those specs go unrun.
                    include: [
                        'src/**/*.{test,spec}.{ts,tsx}',
                        '__tests__/**/*.{test,spec}.{ts,tsx}',
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
