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
import type {
    SwapHistoryItem,
    SwapOrderTransaction,
    SwapStatus,
} from '../../models'
import { swapPayoutOf } from '../swapPayoutOf'

const ALGO = { chainId: 'algorand', networkId: 'mainnet' } as const
const ETH = { chainId: 'ethereum', networkId: 'mainnet' } as const

type Scope = typeof ALGO | typeof ETH

const itemOf = ({
    transactions = [],
    status = 'completed',
    payChain = ALGO,
    receiveChain = ETH,
}: {
    transactions?: SwapOrderTransaction[]
    status?: SwapStatus
    payChain?: Scope | null
    receiveChain?: Scope
} = {}) =>
    ({
        status,
        assetIn: payChain && { ref: { ...payChain, assetId: '0' } },
        assetOut: { ref: { ...receiveChain, assetId: 'native' } },
        transactions,
    }) as unknown as SwapHistoryItem

describe('swapPayoutOf', () => {
    test("returns a settled cross-chain order's payout on the receive chain", () => {
        const item = itemOf({
            transactions: [
                { scope: ALGO, txHash: 'DEP', role: 'deposit' },
                { scope: ETH, txHash: '0xpayout', role: 'payout' },
            ],
        })

        expect(swapPayoutOf(item)).toEqual({
            scope: ETH,
            transactionId: '0xpayout',
        })
    })

    test('has no transaction yet while the order is in flight', () => {
        const pending = itemOf({ status: 'pending' })
        const inProgress = itemOf({
            status: 'in_progress',
            transactions: [{ scope: ALGO, txHash: 'DEP', role: 'deposit' }],
        })

        expect(swapPayoutOf(pending)).toEqual({
            scope: ETH,
            transactionId: undefined,
        })
        expect(swapPayoutOf(inProgress)).toEqual({
            scope: ETH,
            transactionId: undefined,
        })
    })

    test.each<SwapStatus>(['failed', 'refunded', 'cancelled', 'expired'])(
        'is undefined for a %s order that never paid out',
        status => {
            const item = itemOf({
                status,
                transactions: [
                    { scope: ALGO, txHash: 'DEP', role: 'deposit' },
                    { scope: ALGO, txHash: 'BACK', role: 'refund' },
                ],
            })

            expect(swapPayoutOf(item)).toBeUndefined()
        },
    )

    test('skips a payout listed on another chain or with no scope', () => {
        const item = itemOf({
            transactions: [
                { scope: ALGO, txHash: 'WRONG', role: 'payout' },
                { scope: null, txHash: 'NOSCOPE', role: 'payout' },
            ],
        })

        expect(swapPayoutOf(item)).toBeUndefined()
    })

    test('is undefined for a same-chain swap', () => {
        const item = itemOf({
            receiveChain: ALGO,
            transactions: [{ scope: ALGO, txHash: 'SWAP', role: 'swap' }],
        })

        expect(swapPayoutOf(item)).toBeUndefined()
    })

    test('is undefined when the pay asset is unknown', () => {
        expect(swapPayoutOf(itemOf({ payChain: null }))).toBeUndefined()
    })
})
