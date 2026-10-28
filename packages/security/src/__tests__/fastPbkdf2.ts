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

import type * as Pbkdf2Module from '../pbkdf2'

/**
 * `vi.mock('../pbkdf2', ...)` factory for specs that hash PINs as a side
 * effect. The production cost is tens of ms per derivation and those specs
 * chain dozens, so this derives real PBKDF2 at one iteration. pinRecord.spec.ts
 * pins the real cost.
 */
export const fastPbkdf2 = (
    actual: typeof Pbkdf2Module,
): typeof Pbkdf2Module => ({
    ...actual,
    pbkdf2Hash: (pin, salt, _iterations, keyLength, digest) =>
        actual.pbkdf2Hash(pin, salt, 1, keyLength, digest),
})
