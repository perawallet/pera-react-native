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
    },
    resolve: {
        conditions: ['default'],
        // Without these, Vite's dependency pre-bundling resolves
        // @perawallet/wallet-core-blockchain's real
        // @perawallet/wallet-extension-provider import to its installed dist,
        // whose graph reaches react-native-mmkv (a native module vitest can't
        // load) at resolution time — before any vi.mock has a chance to
        // intervene. Pointing at source instead (matching
        // packages/accounts/vitest.config.ts and
        // packages/assets/vitest.config.ts) avoids that path. Needed as of
        // the querykeys.spec.ts drift-detection test, the first test in this
        // package to import real (unmocked) blockchain code.
        alias: {
            '@perawallet/wallet-extension-provider': path.resolve(
                __dirname,
                '../../extensions/provider/src/index.ts',
            ),
            '@perawallet/wallet-extension-platform-driver': path.resolve(
                __dirname,
                '../../extensions/platform-driver/src/index.ts',
            ),
        },
    },
    ...poolConfig,
})
