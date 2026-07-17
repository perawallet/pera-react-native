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

// @vitest-environment node

import { describe, it, expect, beforeEach } from 'vitest'
import {
    applyMockDelegation,
    buildMockDelegationToken,
    buildMockExternalWallets,
    resetMockDelegation,
} from '../mockDelegation'

describe('mockDelegation', () => {
    beforeEach(() => resetMockDelegation())

    it('registers a delegation and reflects it as an external wallet', () => {
        const { token } = buildMockDelegationToken()

        const result = applyMockDelegation({
            address: 'ADDR1',
            amount: '400',
            token,
        })

        expect(result.success).toBe(true)
        expect(buildMockExternalWallets()).toEqual([
            expect.objectContaining({
                address: 'ADDR1',
                allowance: '400',
                network: 'algorand',
            }),
        ])
    })

    it('replaces the allowance on redelegation and zeroes it on cancel', () => {
        applyMockDelegation({
            address: 'ADDR1',
            amount: '400',
            token: buildMockDelegationToken().token,
        })
        applyMockDelegation({
            address: 'ADDR1',
            amount: '0',
            token: buildMockDelegationToken().token,
        })

        expect(buildMockExternalWallets()).toEqual([
            expect.objectContaining({ address: 'ADDR1', allowance: '0' }),
        ])
    })

    it('rejects a reused single-use token', () => {
        const { token } = buildMockDelegationToken()
        applyMockDelegation({ address: 'ADDR1', amount: '400', token })

        const replay = applyMockDelegation({
            address: 'ADDR2',
            amount: '400',
            token,
        })

        expect(replay.success).toBe(false)
        expect(buildMockExternalWallets()).toHaveLength(1)
    })
})
