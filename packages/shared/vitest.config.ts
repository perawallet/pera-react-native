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
import { fileURLToPath } from 'node:url'
import { dirname, resolve } from 'node:path'

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)

export default defineConfig({
    resolve: {
        alias: {
            '@services': resolve(__dirname, 'src/services'),
            '@store': resolve(__dirname, 'src/store'),
            '@api': resolve(__dirname, 'src/api'),
            '@platform': resolve(__dirname, 'src/platform'),
            '@test-utils': resolve(__dirname, 'src/test-utils'),
            config: resolve(__dirname, 'src/config'),
            '@perawallet/wallet-extension-provider': resolve(
                __dirname,
                '../../extensions/provider/src/index.ts',
            ),
            '@perawallet/wallet-extension-platform-driver': resolve(
                __dirname,
                '../../extensions/platform-driver/src/index.ts',
            ),
        },
    },
    test: {
        coverage: coverageConfig,
        globals: true,
        setupFiles: ['./vitest.setup.ts'],
        environment: 'node',
    },
})
