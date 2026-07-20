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

import { describe, it, expect, beforeEach } from 'vitest'
import {
    applyMockDelegatorLsig,
    buildMockEscrowCardCreation,
    resetMockEscrow,
} from '../mockEscrow'

describe('mockEscrow', () => {
    beforeEach(() => resetMockEscrow())

    it('returns the SAME card for repeated creation calls from one address', () => {
        // Mirrors the mutation's resume/reuse semantics: a retry for the same
        // funding account must land on the already-created card.
        const first = buildMockEscrowCardCreation({ address: 'ADDR1' })
        const second = buildMockEscrowCardCreation({ address: 'ADDR1' })

        expect(first.cardAddress).toBe(second.cardAddress)
        expect(first.cardAddress).toHaveLength(58)
    })

    it('returns different cards for different addresses', () => {
        const a = buildMockEscrowCardCreation({ address: 'AAAAAAAA1' })
        const b = buildMockEscrowCardCreation({ address: 'BBBBBBBB2' })

        expect(a.cardAddress).not.toBe(b.cardAddress)
    })

    it('echoes the delegator address on the lsig call', () => {
        expect(
            applyMockDelegatorLsig({ delegatorAddress: 'DELEGATOR1' }),
        ).toEqual({ delegatorAddress: 'DELEGATOR1' })
    })
})
