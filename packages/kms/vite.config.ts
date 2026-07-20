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
                '@perawallet/wallet-extension-platform',
                '@perawallet/wallet-core-shared',
                '@algorandfoundation/keystore',
                '@algorandfoundation/react-native-keystore',
                '@algorandfoundation/xhd-wallet-api',
                '@algorandfoundation/algokit-utils',
                'algosdk',
                '@scure/bip39',
                '@scure/bip39/wordlists/english',
                'tweetnacl',
                'uuid',
                '@perawallet/wallet-extension-provider',
                // On-device Falcon-1024 nitro module (Seam A, PQ-020). Kept
                // external so the app's Metro bundler resolves it; bundling it
                // here would pull in react-native (Flow) and instantiate the
                // native HybridObject at load. rnFalconProvider requires it
                // lazily and only on-device.
                '@joe-p/react-native-falcon',
                'react-native-nitro-modules',
                'react-native',
            ],
        },
    },
})
