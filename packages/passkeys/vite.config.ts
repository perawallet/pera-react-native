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
            exclude: ['**/__tests__/**', '**/*.test.ts', '**/*.test.tsx'],
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
                webauthn: resolve(__dirname, 'src/webauthn.ts'),
                native: resolve(__dirname, 'src/native.ts'),
            },
            formats: ['es'],
        },
        rollupOptions: {
            external: [
                'react',
                'react/jsx-runtime',
                '@algorandfoundation/keystore-core',
                '@algorandfoundation/react-native-keystore',
                '@scure/base',
                '@tanstack/react-query',
                '@tanstack/store',
                '@perawallet/wallet-core-shared',
                '@perawallet/wallet-extension-passkey-autofill',
                '@perawallet/wallet-extension-provider',
            ],
        },
    },
})
