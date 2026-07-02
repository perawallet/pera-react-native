/*
 Copyright 2022-2025 Pera Wallet, LDA
 Licensed under the Apache License, Version 2.0 (the "License");
 you may not use this file except in compliance with the License.
 You may obtain a copy of the License at http://www.apache.org/licenses/LICENSE-2.0
 Unless required by applicable law or agreed to in writing, software
 distributed under the License is distributed on an "AS IS" BASIS,
 WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 See the License for the specific language governing permissions and
 limitations under the License
 */

import { describe, it, expect } from 'vitest'
import { transformInternalWallet } from '../transformers'

describe('transformInternalWallet', () => {
    it('converts the balance string to a Decimal and keeps wallet fields', () => {
        const wallet = transformInternalWallet({
            id: 'wallet_1',
            balance: '125.50',
            currency: 'usdc',
            address: 'BAANX_ADDR',
            addressMemo: '78',
            addressId: 'addr_1',
            type: 'INTERNAL',
        })

        expect(wallet.balance.toFixed(2)).toBe('125.50')
        expect(wallet.id).toBe('wallet_1')
        expect(wallet.currency).toBe('usdc')
        expect(wallet.address).toBe('BAANX_ADDR')
        expect(wallet.addressMemo).toBe('78')
        expect(wallet.addressId).toBe('addr_1')
        expect(wallet.type).toBe('INTERNAL')
    })

    it('falls back to zero balance and empty/null fields for missing values', () => {
        const wallet = transformInternalWallet({
            id: 'wallet_1',
            currency: 'usdc',
        })

        expect(wallet.balance.isZero()).toBe(true)
        expect(wallet.address).toBe('')
        expect(wallet.addressMemo).toBeNull()
        expect(wallet.addressId).toBe('')
        expect(wallet.type).toBe('')
    })
})
