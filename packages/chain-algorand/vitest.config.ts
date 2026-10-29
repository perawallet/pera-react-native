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

import { configDefaults, defineConfig } from 'vitest/config'
import { coverageConfig } from '@perawallet/wallet-core-devtools/vitest/coverage'
import {
    poolConfig,
    vmGlobalsSetup,
} from '@perawallet/wallet-core-devtools/vitest/pool'
import path from 'path'
import { fileURLToPath } from 'url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))

const CONTRACT_SUITES = {
    '@perawallet/wallet-core-assets/testing/adapter-contract':
        '../assets/src/__tests__/assets-adapter-contract.ts',
    '@perawallet/wallet-core-accounts/testing':
        '../accounts/src/__tests__/adapter-contract.ts',
    '@perawallet/wallet-core-backup/testing':
        '../backup/src/__tests__/testing.ts',
    '@perawallet/wallet-core-card/testing':
        '../card/src/__tests__/adapter-contract.ts',
    '@perawallet/wallet-core-chain-contract/testing':
        '../chain-contract/src/__tests__/testing.ts',
    '@perawallet/wallet-core-connections/testing':
        '../connections/src/__tests__/handler-contract.ts',
    '@perawallet/wallet-core-deeplinks/testing':
        '../deeplinks/src/__tests__/adapter-contract.ts',
    '@perawallet/wallet-core-multisig/testing':
        '../multisig/src/__tests__/adapter-contract.ts',
    '@perawallet/wallet-core-nfd/testing':
        '../nfd/src/__tests__/adapter-contract.ts',
    '@perawallet/wallet-core-onramp/testing':
        '../onramp/src/__tests__/adapter-contract.ts',
    '@perawallet/wallet-core-signing/testing':
        '../signing/src/__tests__/testing.ts',
    '@perawallet/wallet-core-swaps/testing':
        '../swaps/src/__tests__/adapter-contract.ts',
    '@perawallet/wallet-core-transactions/testing':
        '../transactions/src/__tests__/testing.ts',
    '@perawallet/wallet-extension-hardware-wallet/testing':
        '../../extensions/hardware-wallet/src/__tests__/app-driver-contract.ts',
}

// The HTTP client rethrows the caller's abort reason, a DOMException from
// Node's realm, which the vmThreads context doesn't see as an Error.
const FORKS_ONLY_SPECS = ['src/blockchain/utils/__tests__/nodeHttp.spec.ts']

export default defineConfig({
    test: {
        ...poolConfig,
        coverage: coverageConfig,
        globals: true,
        environment: 'node',
        setupFiles: [vmGlobalsSetup, './vitest.setup.ts'],
        passWithNoTests: true,
        typecheck: {
            enabled: true,
            include: ['src/**/*.test-d.ts'],
            tsconfig: './tsconfig.typecheck.json',
        },
        projects: [
            {
                extends: true,
                test: {
                    name: 'vm',
                    exclude: [...configDefaults.exclude, ...FORKS_ONLY_SPECS],
                },
            },
            {
                extends: true,
                test: {
                    name: 'forks',
                    pool: 'forks',
                    include: FORKS_ONLY_SPECS,
                    typecheck: { enabled: false },
                },
            },
        ],
    },
    resolve: {
        conditions: ['default'],
        // Resolved from source so vitest transforms them and the setup file's
        // mocks apply; their installed dist would load react-native-mmkv first.
        alias: {
            // Test-only suites, never built or exported: the `/testing`
            // subpaths resolve to source here and in tsconfig.json.
            ...Object.fromEntries(
                Object.entries(CONTRACT_SUITES).map(([name, file]) => [
                    name,
                    path.resolve(__dirname, file),
                ]),
            ),
            // Source, not dist: chain-shared's dist would import the provider's
            // dist and call a different getProvider() than the one mocked here.
            '@perawallet/wallet-core-chain-shared': path.resolve(
                __dirname,
                '../chain-shared/src/index.ts',
            ),
            '@perawallet/wallet-core-shared/test-handlers': path.resolve(
                __dirname,
                '../shared/src/test-handlers.ts',
            ),
            '@perawallet/wallet-extension-provider': path.resolve(
                __dirname,
                '../../extensions/provider/src/index.ts',
            ),
            // The backup and migrate packages reach passkeys, whose dist would
            // load the keystore's native storage before the setup file's mock
            // applies. Subpaths first: a bare-name key also prefix-matches them.
            '@perawallet/wallet-core-passkeys/native': path.resolve(
                __dirname,
                '../passkeys/src/native.ts',
            ),
            '@perawallet/wallet-core-passkeys/crypto': path.resolve(
                __dirname,
                '../passkeys/src/crypto.ts',
            ),
            '@perawallet/wallet-core-passkeys': path.resolve(
                __dirname,
                '../passkeys/src/index.ts',
            ),
            '@perawallet/wallet-extension-platform-driver': path.resolve(
                __dirname,
                '../../extensions/platform-driver/src/index.ts',
            ),
        },
    },
})
