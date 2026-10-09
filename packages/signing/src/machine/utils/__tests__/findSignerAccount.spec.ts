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
import { findSignerAccount } from '../findSignerAccount'

const legacy = { address: 'ALGO_ADDR' } as WalletAccount
const multichain = {
    address: 'ALGO_ADDR_2',
    chains: {
        algorand: { address: 'ALGO_ADDR_2' },
        ethereum: { address: '0xETH' },
    },
} as unknown as WalletAccount

describe('findSignerAccount', () => {
    it("finds an account by its address on the signer's chain", () => {
        expect(
            findSignerAccount([legacy, multichain], '0xETH', 'ethereum'),
        ).toBe(multichain)
    })

    it('finds an Algorand signer by its top-level address', () => {
        expect(
            findSignerAccount([legacy, multichain], 'ALGO_ADDR', 'algorand'),
        ).toBe(legacy)
    })

    it("never matches another chain's address", () => {
        expect(
            findSignerAccount([multichain], 'ALGO_ADDR_2', 'ethereum'),
        ).toBeUndefined()
        expect(
            findSignerAccount([multichain], '0xETH', 'algorand'),
        ).toBeUndefined()
    })
})
