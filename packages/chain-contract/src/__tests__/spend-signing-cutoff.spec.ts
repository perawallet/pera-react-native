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
import { spendSigningCutoffOf, type SpendApproval } from '../models/domain'

const approval = (overrides: Partial<SpendApproval>): SpendApproval => ({
    spender: '0xspender',
    allowances: [],
    isLongLived: false,
    ...overrides,
})

describe('spendSigningCutoffOf', () => {
    it('allows a minute past the signature deadline for a device clock running ahead', () => {
        expect(
            spendSigningCutoffOf(
                approval({
                    signature: { deadline: 1_000_000, isLongLived: false },
                }),
            ),
        ).toBe(1_060_000)
    })

    it("bounds a one-time transfer by the approval's own deadline", () => {
        expect(spendSigningCutoffOf(approval({ deadline: 1_000_000 }))).toBe(
            1_060_000,
        )
    })

    it('has no cutoff when the signature never lapses', () => {
        expect(
            spendSigningCutoffOf(
                approval({
                    deadline: 1_000_000,
                    signature: { isLongLived: true },
                }),
            ),
        ).toBeUndefined()
    })
})
