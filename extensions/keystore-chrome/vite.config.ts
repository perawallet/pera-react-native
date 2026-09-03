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

import { defineConfig } from 'vite'
import { resolve } from 'path'
import dts from 'vite-plugin-dts'

export default defineConfig({
    plugins: [
        dts({
            include: ['src'],
            exclude: ['**/__tests__/**', '**/*.test.ts', '**/test-utils/**'],
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
            entry: {
                index: resolve(__dirname, 'src/index.ts'),
                bootstrap: resolve(__dirname, 'src/bootstrap.ts'),
                'vault/autolock': resolve(__dirname, 'src/vault/autolock.ts'),
            },
            formats: ['es'],
        },
        rollupOptions: {
            external: [
                '@algorandfoundation/dp256',
                '@algorandfoundation/wallet-provider',
                '@algorandfoundation/xhd-wallet-api',
                '@algorandfoundation/xhd-wallet-api/dist/sumo.facade.js',
                '@noble/ciphers',
                '@noble/hashes/sha2.js',
                '@scure/base',
                '@scure/bip39',
                '@scure/bip39/wordlists/english.js',
                '@tanstack/store',
                'before-after-hook',
                '@perawallet/wallet-core-passkeys/webauthn',
            ],
        },
    },
})
