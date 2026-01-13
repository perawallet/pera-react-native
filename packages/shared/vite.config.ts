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
import react from '@vitejs/plugin-react'
import dts from 'vite-plugin-dts'

export default defineConfig({
    plugins: [
        react(),
        dts({
            include: ['src'],
            exclude: [
                '**/__tests__/**',
                '**/*.test.ts',
                '**/*.test.tsx',
                '**/test-utils/**',
            ],
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
                '@tanstack/react-query-persist-client',
                '@perawallet/wallet-core-config',
                '@algorandfoundation/algokit-utils',
                '@algorandfoundation/xhd-wallet-api',
                '@kubb/core',
                '@kubb/plugin-client',
                'base32-encode',
                'base64-js',
                'bip39',
                'decimal.js',
                'ky',
                'react-native-quick-base64',
                'reflect-metadata',
                'tsyringe',
                'util',
                'uuid',
                'zod',
                'crypto',
            ],
        },
    },
})
