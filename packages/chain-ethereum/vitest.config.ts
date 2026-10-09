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
        ...poolConfig,
        coverage: coverageConfig,
        globals: true,
        environment: 'node',
        setupFiles: ['./vitest.setup.ts'],
        typecheck: {
            enabled: true,
            include: ['src/**/*.test-d.ts'],
            tsconfig: './tsconfig.typecheck.json',
        },
    },
    resolve: {
        conditions: ['default'],
        alias: {
            '@perawallet/wallet-core-accounts/testing/account-state':
                path.resolve(
                    __dirname,
                    '../accounts/src/__tests__/account-state-contract.ts',
                ),
            '@perawallet/wallet-core-accounts/testing': path.resolve(
                __dirname,
                '../accounts/src/__tests__/adapter-contract.ts',
            ),
            '@perawallet/wallet-core-chain-contract/testing': path.resolve(
                __dirname,
                '../chain-contract/src/__tests__/testing.ts',
            ),
            '@perawallet/wallet-core-kms/constants': path.resolve(
                __dirname,
                '../kms/src/constants.ts',
            ),
        },
    },
})
