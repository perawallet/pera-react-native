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
import { Decimal } from 'decimal.js'
import {
    HoldingRestrictions,
    type AccountChainAssetBalance,
} from '@perawallet/wallet-core-accounts'
import { groupSwapPayHoldings } from '../groupSwapPayHoldings'

const ALGO = { chainId: 'algorand', networkId: 'mainnet' } as const
const ETH = { chainId: 'ethereum', networkId: 'mainnet' } as const

const holding = (
    accountId: string,
    amount: number,
    overrides: Partial<AccountChainAssetBalance> = {},
): AccountChainAssetBalance => ({
    accountId,
    address: `${accountId}-address`,
    assetId: 'usdc',
    scope: ALGO,
    amount: new Decimal(amount),
    nativeValue: new Decimal(amount),
    fiatValue: new Decimal(amount),
    restriction: null,
    ...overrides,
})

describe('groupSwapPayHoldings', () => {
    it('totals one asset over the accounts holding it, the largest holder first', () => {
        const [usdc] = groupSwapPayHoldings([holding('a', 2), holding('b', 5)])

        expect(usdc.amount).toEqual(new Decimal(7))
        expect(usdc.fiatValue).toEqual(new Decimal(7))
        expect(usdc.holders.map(h => h.accountId)).toEqual(['b', 'a'])
    })

    it('keeps the same asset id on two chains apart', () => {
        const groups = groupSwapPayHoldings([
            holding('a', 1),
            holding('a', 1, { scope: ETH }),
        ])

        expect(groups.map(g => g.scope.chainId)).toEqual([
            'algorand',
            'ethereum',
        ])
    })

    it('has no value when a holder has none', () => {
        const [usdc] = groupSwapPayHoldings([
            holding('a', 1),
            holding('b', 1, { fiatValue: null }),
        ])

        expect(usdc.fiatValue).toBeNull()
    })

    it('offers no empty or frozen holder while another can pay', () => {
        const [usdc] = groupSwapPayHoldings([
            holding('empty', 0),
            holding('frozen', 9, {
                restriction: HoldingRestrictions.transferBlocked,
            }),
            holding('funded', 3),
        ])

        expect(usdc.holders.map(h => h.accountId)).toEqual(['funded'])
        expect(usdc.amount).toEqual(new Decimal(3))
        expect(usdc.restriction).toBeNull()
    })

    it('still lists an asset every holder has emptied', () => {
        const [usdc] = groupSwapPayHoldings([holding('a', 0), holding('b', 0)])

        expect(usdc.holders).toHaveLength(2)
    })

    it('blocks an asset every holder has frozen', () => {
        const [usdc] = groupSwapPayHoldings([
            holding('a', 1, {
                restriction: HoldingRestrictions.transferBlocked,
            }),
        ])

        expect(usdc.restriction).toBe(HoldingRestrictions.transferBlocked)
    })
})
