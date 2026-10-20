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
import type {
    FeeAdjustment,
    UnsignedTransactionSignRequest,
} from '@perawallet/wallet-core-signing'
import {
    algorandHandoffDeliveryOf,
    algorandRequestChainData,
    algorandReviewGroupOf,
    algorandSignableGroupChainData,
    type AlgorandRequestData,
} from '../requestChainData'
import {
    asUnsignedAlgorandTransaction,
    makeTestAddress,
    makeTestPaymentTx,
} from './transactions'

const [tx0, tx1, tx2] = [1n, 2n, 3n].map(amount =>
    asUnsignedAlgorandTransaction(
        makeTestPaymentTx(makeTestAddress(1), {
            receiver: makeTestAddress(2),
            amount,
        }),
    ),
)
const signerOverrides = new Map([[0, 'AUTH']])
const feeAdjustments: FeeAdjustment[] = [
    { index: 1, originalFee: 1n, adjustedFee: 2n, reason: 'quantum-minimum' },
]

const requestWith = (
    txs: UnsignedTransactionSignRequest['txs'],
    data?: AlgorandRequestData,
): UnsignedTransactionSignRequest => ({
    id: 'req',
    type: 'transactions',
    transport: 'callback',
    txs,
    ...(data && { chainData: algorandRequestChainData(data) }),
})

describe('algorandReviewGroupOf', () => {
    it('reads the group facts the source sent', () => {
        const request = requestWith([tx1], {
            groupContext: [tx0, tx1],
            signableIndices: [1],
            signerOverrides,
            feeAdjustments,
        })

        expect(algorandReviewGroupOf(request)).toEqual({
            transactions: [tx0, tx1],
            groupContext: [tx0, tx1],
            signableIndices: [1],
            signerOverrides,
            feeAdjustments,
        })
    })

    it('shows `txs` when the request carries no full group', () => {
        expect(algorandReviewGroupOf(requestWith([tx0]))).toEqual({
            transactions: [tx0],
        })
    })
})

describe('algorandSignableGroupChainData', () => {
    it("signs every slot of the group and keeps the request's bytes for them", () => {
        const request = requestWith([tx0, tx1, tx2], {
            rawTransactionsBase64: ['a', 'b', 'c'],
        })

        expect(algorandSignableGroupChainData(request, [0, 2])).toEqual({
            algorand: {
                indicesToSign: [0, 1],
                rawTransactionsBase64: ['a', 'c'],
            },
        })
    })

    it('carries no bytes for a request that sent none', () => {
        expect(algorandSignableGroupChainData(requestWith([tx0]), [0])).toEqual(
            { algorand: { indicesToSign: [0] } },
        )
    })
})

describe('algorandHandoffDeliveryOf', () => {
    it('is what a WalletConnect request needs to answer after an app kill', () => {
        const request = requestWith([tx1], {
            payloadId: 77,
            signableIndices: [1],
            totalLength: 2,
        })

        expect(algorandHandoffDeliveryOf(request)).toEqual({
            payloadId: 77,
            indicesToSign: [1],
            totalLength: 2,
        })
    })

    it('is undefined for a request no dApp waits on', () => {
        expect(
            algorandHandoffDeliveryOf(
                requestWith([tx0], { signableIndices: [0] }),
            ),
        ).toBeUndefined()
    })
})
