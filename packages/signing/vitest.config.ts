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
        environment: 'jsdom',
        setupFiles: ['./vitest.setup.ts'],
    },
    resolve: {
        conditions: ['default'],
        alias: {
            // Test-only: the real Algorand accounts adapter, so specs resolve
            // signers with the production rules. Not a package dependency,
            // because chain-algorand depends on signing.
            '@perawallet/wallet-core-chain-algorand/accounts': path.resolve(
                __dirname,
                '../chain-algorand/src/accounts/index.ts',
            ),
            '@perawallet/wallet-core-chain-algorand/descriptor': path.resolve(
                __dirname,
                '../chain-algorand/src/descriptor/index.ts',
            ),
            '@perawallet/wallet-extension-provider': path.resolve(
                __dirname,
                '../../extensions/provider/src/index.ts',
            ),
            '@perawallet/wallet-extension-platform-driver': path.resolve(
                __dirname,
                '../../extensions/platform-driver/src/index.ts',
            ),
            // Before the bare specifier: an alias key also prefix-matches its subpaths.
            '@perawallet/wallet-extension-platform/test-utils': path.resolve(
                __dirname,
                '../../extensions/platform/src/test-utils/index.ts',
            ),
            '@perawallet/wallet-extension-platform': path.resolve(
                __dirname,
                '../../extensions/platform/src/index.ts',
            ),
            '@perawallet/wallet-core-hardware-wallet': path.resolve(
                __dirname,
                '../hardware-wallet/src/index.ts',
            ),
            '@perawallet/wallet-core-ledger': path.resolve(
                __dirname,
                '../ledger/src/index.ts',
            ),
            // Must precede the barrel entry: these aliases prefix-match, so
            // the barrel would otherwise swallow the subpath.
            '@perawallet/wallet-core-kms/constants': path.resolve(
                __dirname,
                '../kms/src/constants.ts',
            ),
            '@perawallet/wallet-core-kms': path.resolve(
                __dirname,
                '../kms/src/index.ts',
            ),
            // Source, not dist: the dist reaches a second getProvider()
            // instance the mocks here never see.
            '@perawallet/wallet-core-chain-shared': path.resolve(
                __dirname,
                '../chain-shared/src/index.ts',
            ),
            '@perawallet/wallet-core-assets': path.resolve(
                __dirname,
                '../assets/src/index.ts',
            ),
            '@perawallet/wallet-core-database/test-utils': path.resolve(
                __dirname,
                '../database/src/test-utils/index.ts',
            ),
            '@perawallet/wallet-core-database': path.resolve(
                __dirname,
                '../database/src/index.ts',
            ),
        },
    },
})
