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

export default defineConfig({
    plugins: [],
    build: {
        lib: {
            entry: {
                index: resolve(__dirname, 'src/index.ts'),
                // Its own entry so the barrel never re-exports the v2
                // handler: `apps/browser` imports the barrel and must stay
                // clear of @reown/walletkit.
                'v2/index': resolve(__dirname, 'src/v2/index.ts'),
            },
            formats: ['es'],
        },
        rollupOptions: {
            external: [
                'react',
                'react/jsx-runtime',
                'react-native',
                'zustand',
                '@perawallet/wallet-core-accounts',
                '@perawallet/wallet-core-blockchain',
                '@perawallet/wallet-core-config',
                '@perawallet/wallet-extension-platform',
                '@perawallet/wallet-core-shared',
                '@perawallet/wallet-core-signing',
                '@perawallet/walletconnect',
                '@perawallet/walletconnect/types',
                '@reown/walletkit',
                '@walletconnect/core',
                '@walletconnect/utils',
                'uuid',
                '@perawallet/wallet-extension-provider',
            ],
        },
    },
})
