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
import path from 'path'
import { fileURLToPath } from 'url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))

export default defineConfig({
    test: {
        coverage: coverageConfig,
        globals: true,
        environment: 'jsdom',
        setupFiles: ['./vitest.setup.ts'],
    },
    resolve: {
        conditions: ['default'],
        alias: {
            '@perawallet/wallet-extension-provider': path.resolve(
                __dirname,
                '../../extensions/provider/src/index.ts',
            ),
            '@perawallet/wallet-extension-platform-driver': path.resolve(
                __dirname,
                '../../extensions/platform-driver/src/index.ts',
            ),
            '@perawallet/wallet-extension-platform': path.resolve(
                __dirname,
                '../../extensions/platform/src/index.ts',
            ),
            '@perawallet/wallet-core-accounts': path.resolve(
                __dirname,
                '../accounts/src/index.ts',
            ),
            '@perawallet/wallet-core-currencies': path.resolve(
                __dirname,
                '../currencies/src/index.ts',
            ),
            '@perawallet/wallet-core-kms': path.resolve(
                __dirname,
                '../kms/src/index.ts',
            ),
            '@perawallet/wallet-core-passkeys/native': path.resolve(
                __dirname,
                '../passkeys/src/native.ts',
            ),
            '@perawallet/wallet-core-database/test-utils': path.resolve(
                __dirname,
                '../database/src/test-utils/index.ts',
            ),
            '@perawallet/wallet-core-database': path.resolve(
                __dirname,
                '../database/src/index.ts',
            ),
            '@perawallet/wallet-core-hardware-wallet': path.resolve(
                __dirname,
                '../hardware-wallet/src/index.ts',
            ),
        },
    },
    ...poolConfig,
})
