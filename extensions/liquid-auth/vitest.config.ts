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
import { resolve } from 'path'
import { coverageConfig } from '@perawallet/wallet-core-devtools/vitest/coverage'
import { poolConfig } from '@perawallet/wallet-core-devtools/vitest/pool'

export default defineConfig({
    resolve: {
        alias: {
            // The native @react-native-cookies/cookies module can't load under
            // jsdom. sessionCookie.ts imports its default export, so route it
            // to an inert stub; cookie-extraction tests inject their own reader.
            '@react-native-cookies/cookies': resolve(
                __dirname,
                './src/__tests__/stubs/react-native-cookies.ts',
            ),
        },
    },
    test: {
        coverage: coverageConfig,
        passWithNoTests: true,
    },
    ...poolConfig,
})
