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

import { describe, expect, it } from 'vitest'
import { algorandNameServiceAdapter } from '../adapter'

describe('algorandNameServiceAdapter', () => {
    it('accepts only checksummed Algorand addresses', () => {
        const valid =
            'A4DQOBYHA4DQOBYHA4DQOBYHA4DQOBYHA4DQOBYHA4DQOBYHA4DVZ36IB4'

        expect(algorandNameServiceAdapter.isValidAddress(valid)).toBe(true)
        expect(algorandNameServiceAdapter.isValidAddress('')).toBe(false)
        expect(
            algorandNameServiceAdapter.isValidAddress('not-a-real-address'),
        ).toBe(false)
        // Right length and alphabet, wrong checksum: what a shape-only check
        // would let through.
        expect(algorandNameServiceAdapter.isValidAddress('A'.repeat(58))).toBe(
            false,
        )
    })
})
