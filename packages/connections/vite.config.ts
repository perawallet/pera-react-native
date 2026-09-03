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
                'testing/handler-contract': resolve(
                    __dirname,
                    'src/testing/handler-contract.ts',
                ),
                // Its own entry so a consumer can read the pairing budgets
                // without the barrel dragging in the signing adapter.
                pairingOutcome: resolve(__dirname, 'src/pairingOutcome.ts'),
            },
            formats: ['es'],
        },
        rollupOptions: {
            external: [
                'react',
                'react/jsx-runtime',
                'zustand',
                'zod',
                'vitest',
                '@perawallet/wallet-core-shared',
                '@perawallet/wallet-core-signing',
                '@perawallet/wallet-core-accounts',
                '@perawallet/wallet-core-blockchain',
                '@perawallet/wallet-extension-connections',
            ],
        },
    },
})
