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

import type * as Argon2Module from '../vault/argon2'

/**
 * `vi.mock('../argon2', ...)` factory for vault specs. The pinned cost is
 * seconds per derivation under CI contention and those specs chain dozens, so
 * this derives real Argon2id at the minimum cost whatever the blob asks for.
 * The blob still records the requested params; argon2.spec.ts covers the KDF.
 */
export const fastArgon2 = (
    actual: typeof Argon2Module,
): typeof Argon2Module => ({
    ...actual,
    deriveArgon2id: async request =>
        actual.computeArgon2id({ ...request, m: 8, t: 1, p: 1 }),
})
