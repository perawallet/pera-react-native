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
import {
    poolConfig,
    vmGlobalsSetup,
} from '@perawallet/wallet-core-devtools/vitest/pool'

// Only the runner's pure logic is tested here; the scenarios themselves need a
// device (Hermes, expo-sqlite, the native keystore).
export default defineConfig({
    test: {
        ...poolConfig,
        globals: true,
        environment: 'node',
        setupFiles: [vmGlobalsSetup],
        include: ['src/**/__tests__/**/*.spec.ts'],
    },
})
