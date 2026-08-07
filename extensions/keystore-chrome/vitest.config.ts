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
        // expensive is the entire point, and vault.test.ts asserts those pinned
        // values directly, so the budget gets raised rather than the cost
        // lowered. Sized off the worst case: the throttling spec that fills and
        // clears the 5-attempt lockout twice chains 11 derivations, and under
        // `turbo run test` (54 sibling vitest processes, each pool sized to
        // cpus/2) one derivation stretches from ~330ms to ~2.9s — 32s in all,
        // which is what overran the previous 30s ceiling. Hooks only build the
        // chrome fake, so they keep the tighter budget.
        testTimeout: 120_000,
        hookTimeout: 30_000,
    },
    ...poolConfig,
})
