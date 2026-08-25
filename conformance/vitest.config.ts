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

import { resolve } from 'node:path'
import { defineConfig } from 'vitest/config'

const pkg = (name: string, dir: string): [string, string] => [
    `@perawallet/${name}`,
    resolve(import.meta.dirname, `../packages/${dir}/src`),
]

export default defineConfig({
    resolve: {
        alias: Object.fromEntries([
            pkg('wallet-core-blockchain', 'blockchain'),
            pkg('wallet-core-accounts', 'accounts'),
            pkg('wallet-core-config', 'config'),
            pkg('wallet-core-kms', 'kms'),
            pkg('wallet-core-signing', 'signing'),
            pkg('wallet-core-shared', 'shared'),
            pkg('wallet-core-transactions', 'transactions'),
            // Same alias blockchain's/signing's own vitest.config.ts carry: without
            // it, `environment: 'node'` externalizes this bare specifier to the
            // real built provider (pulled in transitively via wallet-core-remote-config),
            // whose react-native-mmkv dependency has extensionless imports Node's
            // native loader can't resolve — and externalized modules bypass
            // vitest.setup.ts's vi.mock entirely, so the crash happens before the
            // mock ever gets a chance.
            [
                '@perawallet/wallet-extension-provider',
                resolve(
                    import.meta.dirname,
                    '../extensions/provider/src/index.ts',
                ),
            ],
        ]),
    },
    test: {
        environment: 'node',
        globals: true,
        include: ['src/**/*.spec.ts'],
        // `@perawallet/wallet-extension-provider` mock for the network/accounts
        // stores the submission chokepoint reaches through — see vitest.setup.ts.
        setupFiles: ['./vitest.setup.ts'],
        // Chain state is shared across files; parallel runs race on account balances.
        fileParallelism: false,
        testTimeout: 120_000,
        hookTimeout: 120_000,
    },
})
