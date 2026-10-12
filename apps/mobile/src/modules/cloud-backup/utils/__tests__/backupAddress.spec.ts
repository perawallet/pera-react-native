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

import { describe, it, expect } from 'vitest'
import type { WalletAccount } from '@perawallet/wallet-core-accounts'
import { backupAccountsOf, backupAddressOf } from '../backupAddress'

const account = (
    id: string,
    chains: WalletAccount['chains'],
): WalletAccount => ({
    id,
    custody: { kind: 'watch' },
    chains,
})

const algorand = account('algo', { algorand: { address: 'ALGO_ADDR' } })
const ethereumOnly = account('eth', { ethereum: { address: '0xabc' } })

describe('backupAddressOf', () => {
    it("keys the backup item by the account's address on the backup chain", () => {
        expect(backupAddressOf(algorand)).toBe('ALGO_ADDR')
    })

    it('has no key for an account with nothing on the backup chain', () => {
        expect(backupAddressOf(ethereumOnly)).toBeUndefined()
    })
})

describe('backupAccountsOf', () => {
    it('pairs each account that has a backup item with its key, in order', () => {
        const other = account('other', { algorand: { address: 'OTHER' } })

        expect(backupAccountsOf([algorand, ethereumOnly, other])).toEqual([
            { account: algorand, address: 'ALGO_ADDR' },
            { account: other, address: 'OTHER' },
        ])
    })

    it('is empty when no account has a backup item', () => {
        expect(backupAccountsOf([ethereumOnly])).toEqual([])
    })
})
