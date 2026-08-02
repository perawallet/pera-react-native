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

export default defineConfig({
    test: {
        coverage: coverageConfig,
        // The vault KDF is Argon2id at OWASP's baseline (19 MiB, t=2) — being
        // expensive is the entire point, and a single derivation costs a few
        // hundred milliseconds. Tests that create, unlock, change a password,
        // or exhaust the 5-attempt lockout chain several derivations together,
        // which is comfortably over vitest's 5s default once `turbo run test`
        // is contending for cores with every other package. Raised rather than
        // weakening the parameters under test: these specs are the only place
        // the real cost is exercised.
        testTimeout: 30_000,
        hookTimeout: 30_000,
    },
    ...poolConfig,
})
