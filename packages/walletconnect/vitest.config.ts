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
            // Source, not `dist`, so tests cannot pass against a stale build
            // artifact. Both aliases are load-bearing: `Networks`
            // (betanet/custom) lives in packages/config and shared only
            // re-exports it, so aliasing shared alone still resolves that
            // re-export through config's own dist.
            '@perawallet/wallet-core-shared': path.resolve(
                __dirname,
                '../shared/src/index.ts',
            ),
            '@perawallet/wallet-core-config': path.resolve(
                __dirname,
                '../config/src/index.ts',
            ),
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
            '@perawallet/wallet-core-signing': path.resolve(
                __dirname,
                '../signing/src/index.ts',
            ),
            '@perawallet/wallet-core-kms': path.resolve(
                __dirname,
                '../kms/src/index.ts',
            ),
            '@perawallet/wallet-core-accounts': path.resolve(
                __dirname,
                '../accounts/src/index.ts',
            ),
            '@perawallet/wallet-core-blockchain': path.resolve(
                __dirname,
                '../blockchain/src/index.ts',
            ),
            '@perawallet/wallet-core-device': path.resolve(
                __dirname,
                '../device/src/index.ts',
            ),
            // The `/testing` subpath needs its own entry — aliasing the
            // package root does not cover it, and the v1 handler spec runs
            // the shared handler contract suite from there.
            '@perawallet/wallet-core-connections/testing': path.resolve(
                __dirname,
                '../connections/src/testing/handler-contract.ts',
            ),
            '@perawallet/wallet-core-connections': path.resolve(
                __dirname,
                '../connections/src/index.ts',
            ),
            '@perawallet/wallet-extension-connections': path.resolve(
                __dirname,
                '../../extensions/connections/src/index.ts',
            ),
        },
    },
    ...poolConfig,
})
