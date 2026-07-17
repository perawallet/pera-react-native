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
    applyMockWithdrawal,
    buildMockInternalWallets,
    resetMockInternalWallets,
} from '../mockInternalWallets'

describe('mockInternalWallets', () => {
    beforeEach(() => resetMockInternalWallets())

    it('returns a single USDC internal wallet in the Baanx wire shape', () => {
        const wallets = buildMockInternalWallets()

        expect(wallets).toHaveLength(1)
        expect(wallets[0]).toMatchObject({
            currency: 'usdc',
            type: 'INTERNAL',
        })
        expect(wallets[0].balance).toBe('240.00')
        expect(wallets[0].address).toBeTruthy()
    })

    it('decrements the balance when a withdrawal is applied', () => {
        applyMockWithdrawal('40')

        expect(buildMockInternalWallets()[0].balance).toBe('200.00')
    })

    it('clamps the balance at zero for over-withdrawals', () => {
        applyMockWithdrawal('1000')

        expect(buildMockInternalWallets()[0].balance).toBe('0.00')
    })

    it('restores the initial balance on reset', () => {
        applyMockWithdrawal('40')
        resetMockInternalWallets()

        expect(buildMockInternalWallets()[0].balance).toBe('240.00')
    })
})
