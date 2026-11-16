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

import { describe, expect, test } from 'vitest'
import type { SwapDistinctPairItem } from '../../models'
import { pairsPaidBy } from '../pairsPaidBy'

const ALGO = { chainId: 'algorand', networkId: 'mainnet' } as const
const ETH = { chainId: 'ethereum', networkId: 'mainnet' } as const

const assetOn = (scope: typeof ALGO | typeof ETH, assetId: string) => ({
    assetId,
    ref: { ...scope, assetId },
})

const pair = (
    payer: { scope: typeof ALGO | typeof ETH; address: string },
    legs: [typeof ALGO | typeof ETH, typeof ALGO | typeof ETH] = [
        payer.scope,
        payer.scope,
    ],
) =>
    ({
        assetIn: assetOn(legs[0], 'in'),
        assetOut: assetOn(legs[1], 'out'),
        sourceAccount: payer,
        swapDatetime: '2026-10-01T00:00:00Z',
        pairKey: `${payer.address}|${legs[0].chainId}|${legs[1].chainId}`,
    }) as unknown as SwapDistinctPairItem

const PAYERS = [
    { scope: ALGO, address: 'MAIN', accountId: 'main' },
    { scope: ETH, address: '0xAbC', accountId: 'other' },
]
const canPayAnywhere = () => true

describe('swaps/pairsPaidBy', () => {
    test('tags each pair with its payer, matching an EVM address in any casing', () => {
        const paid = pair({ scope: ETH, address: '0xabc' })

        expect(pairsPaidBy([paid], PAYERS, canPayAnywhere)).toEqual([
            { ...paid, accountId: 'other' },
        ])
    })

    test('leaves out a cross-chain pair, an unknown payer and a pair with no payer', () => {
        const crossChain = pair({ scope: ALGO, address: 'MAIN' }, [ALGO, ETH])
        const stranger = pair({ scope: ALGO, address: 'STRANGER' })
        const unpaid = {
            ...pair({ scope: ALGO, address: 'MAIN' }),
            sourceAccount: null,
        }

        expect(
            pairsPaidBy([crossChain, stranger, unpaid], PAYERS, canPayAnywhere),
        ).toEqual([])
    })

    test('leaves out a pair its payer can no longer pay on', () => {
        const paid = pair({ scope: ALGO, address: 'MAIN' })

        expect(pairsPaidBy([paid], PAYERS, () => false)).toEqual([])
    })
})
