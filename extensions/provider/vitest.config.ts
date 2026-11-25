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

import { fileURLToPath } from 'node:url'
import { defineConfig } from 'vitest/config'
import { coverageConfig } from '@perawallet/wallet-core-devtools/vitest/coverage'
import {
    poolConfig,
    vmGlobalsSetup,
} from '@perawallet/wallet-core-devtools/vitest/pool'

// The keystore package is inlined so specs can load its real migrations and
// crypto off device; its native Keychain and MMKV imports resolve to a stub
// (MMKV's mock in vitest.setup.ts then applies to both copies).
const nativeStub = fileURLToPath(
    new URL(
        './src/keystore/migrations/__fixtures__/nativeStub.ts',
        import.meta.url,
    ),
)

export default defineConfig({
    test: {
        ...poolConfig,
        coverage: coverageConfig,
        globals: true,
        environment: 'node',
        setupFiles: [vmGlobalsSetup, './vitest.setup.ts'],
        server: {
            deps: { inline: [/react-native-keystore/] },
        },
    },
    resolve: {
        conditions: ['default'],
        alias: {
            'react-native-keychain': nativeStub,
            'react-native-mmkv': nativeStub,
        },
    },
})
