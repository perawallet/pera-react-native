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
            { find: '@', replacement: path.resolve(__dirname, './src') },
            {
                find: '@perawallet/wallet-core-shared',
                replacement: path.resolve(
                    __dirname,
                    '../../packages/shared/src/index.ts',
                ),
            },
            {
                find: '@perawallet/wallet-core-platform-integration',
                replacement: path.resolve(
                    __dirname,
                    '../../packages/platform-integration/src/index.ts',
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
                find: '@perawallet/wallet-core-swaps',
                replacement: path.resolve(
                    __dirname,
                    '../../packages/swaps/src/index.ts',
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
        globals: true,
        environment: 'jsdom',
        setupFiles: ['./vitest.setup.ts'],
        server: {
            deps: {
                inline: [/@react-navigation/, /react-native-ratings/],
            },
        },
    },
})
