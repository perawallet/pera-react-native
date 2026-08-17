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

import { defineConfig } from 'vite'
import { resolve } from 'path'
import dts from 'vite-plugin-dts'

export default defineConfig({
    plugins: [
        dts({
            include: ['src'],
            exclude: [
                '**/__tests__/**',
                '**/*.test.ts',
                '**/*.test.tsx',
                '**/{handlers,*-handlers}.ts',
            ],
            afterDiagnostic: diagnostics => {
                if (diagnostics.length > 0) {
                    throw new Error(
                        `TypeScript declaration generation failed with ${diagnostics.length} error(s)`,
                    )
                }
            },
        }),
    ],
    build: {
        lib: {
            entry: resolve(__dirname, 'src/index.ts'),
            formats: ['es'],
            fileName: 'index',
        },
        rollupOptions: {
            external: [
                'react',
                'react/jsx-runtime',
                'zustand',
                '@tanstack/react-query',
                '@tanstack/store',
                'before-after-hook',
                '@algorandfoundation/keystore-core',
                '@algorandfoundation/provider-migrations',
                '@algorandfoundation/react-native-keystore',
                '@algorandfoundation/wallet-provider',
                'react-native-mmkv',
                'react-native-quick-crypto',
                '@perawallet/wallet-core-shared',
                '@perawallet/wallet-extension-platform',
                '@perawallet/wallet-extension-platform-driver',
                '@perawallet/wallet-extension-ledger-react-native',
                '@perawallet/wallet-extension-ledger-react-native-usb',
                '@perawallet/wallet-extension-ledger-web-ble',
                '@perawallet/wallet-extension-ledger-web-usb',
                '@perawallet/wallet-extension-passkey-autofill',
                '@perawallet/wallet-core-accounts',
                '@perawallet/wallet-core-hardware-wallet',
                '@perawallet/wallet-core-blockchain',
                '@perawallet/wallet-core-config',
                '@perawallet/wallet-core-contacts',
                '@perawallet/wallet-core-currencies',
                '@perawallet/wallet-core-kms',
                '@perawallet/wallet-core-messages',
                '@perawallet/wallet-core-polling',
                '@perawallet/wallet-core-security',
                '@perawallet/wallet-core-settings',
                '@perawallet/wallet-core-signing',
                '@perawallet/wallet-core-swaps',
                '@perawallet/wallet-core-walletconnect',
                '@algorandfoundation/xhd-wallet-api',
                'uuid',
                'decimal.js',
            ],
        },
    },
})
