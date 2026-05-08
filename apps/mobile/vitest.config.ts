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
                replacement: 'react-native-web',
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
                find: '@perawallet/wallet-core-shared/test-handlers',
                replacement: path.resolve(
                    __dirname,
                    '../../packages/shared/src/test-handlers.ts',
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
                find: '@perawallet/wallet-extension-platform-driver',
                replacement: path.resolve(
                    __dirname,
                    '../../extensions/platform-driver/src/index.ts',
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
                },
            },
        ],
    },
    ...poolConfig,
})
