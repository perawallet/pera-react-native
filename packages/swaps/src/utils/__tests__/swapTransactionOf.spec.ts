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
import type { SwapHistoryItem, SwapOrderTransaction } from '../../models'
import { swapTransactionOf } from '../swapTransactionOf'

const ALGO = { chainId: 'algorand', networkId: 'mainnet' } as const
const ETH = { chainId: 'ethereum', networkId: 'mainnet' } as const

const itemOf = (
    transactions: SwapOrderTransaction[],
    payChain: typeof ALGO | typeof ETH | null = ETH,
) =>
    ({
        assetIn: payChain && {
            assetId: '0',
            ref: { ...payChain, assetId: '0' },
        },
        transactions,
    }) as unknown as SwapHistoryItem

describe('swapTransactionOf', () => {
    test('returns the swap transaction on the pay chain', () => {
        const item = itemOf([{ scope: ETH, txHash: '0x1', role: 'swap' }])

        expect(swapTransactionOf(item)).toEqual({
            scope: ETH,
            transactionId: '0x1',
        })
    })

    test("returns a cross-chain order's deposit on the pay chain, not its payout", () => {
        const item = itemOf(
            [
                { scope: ALGO, txHash: 'DEP', role: 'deposit' },
                { scope: ETH, txHash: '0xpayout', role: 'payout' },
            ],
            ALGO,
        )

        expect(swapTransactionOf(item)).toEqual({
            scope: ALGO,
            transactionId: 'DEP',
        })
    })

    test('skips a payout and a swap transaction on another chain', () => {
        const item = itemOf([
            { scope: ETH, txHash: '0xpayout', role: 'payout' },
            { scope: ALGO, txHash: 'ALGOTX', role: 'swap' },
        ])

        expect(swapTransactionOf(item)).toBeUndefined()
    })

    test('is undefined with no transactions listed', () => {
        expect(swapTransactionOf(itemOf([]))).toBeUndefined()
    })

    test('is undefined when the matching transaction has no scope', () => {
        const item = itemOf([{ scope: null, txHash: '0x1', role: 'swap' }])

        expect(swapTransactionOf(item)).toBeUndefined()
    })

    test('is undefined when the pay asset is unknown', () => {
        const item = itemOf([{ scope: ETH, txHash: '0x1', role: 'swap' }], null)

        expect(swapTransactionOf(item)).toBeUndefined()
    })
})
