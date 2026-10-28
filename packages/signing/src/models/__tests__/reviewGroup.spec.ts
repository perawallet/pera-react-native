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

import { afterEach, describe, expect, it, vi } from 'vitest'
import { plannerChainAdapters } from '../../chain-adapter'
import { registerFakePlannerAdapter } from '../../__tests__/fakePlannerAdapter'
import {
    SECOND_CHAIN_SCOPE,
    makeUnsignedTransaction,
} from '../../__tests__/transactions'
import type { TransactionSignRequest } from '../index'
import { reviewGroupOf } from '../reviewGroup'

const txs = [makeUnsignedTransaction('FROM')]
const request: TransactionSignRequest = {
    id: 'req',
    type: 'transactions',
    transport: 'callback',
    txs,
    chainData: { opaque: true },
}

describe('reviewGroupOf', () => {
    afterEach(() => plannerChainAdapters.reset())

    it("reads the group through the request chain's planner", () => {
        const group = { transactions: txs, signableIndices: [0] }
        const adapterReviewGroupOf = vi.fn(() => group)
        registerFakePlannerAdapter({
            chainId: SECOND_CHAIN_SCOPE.chainId,
            reviewGroupOf: adapterReviewGroupOf,
        })

        expect(reviewGroupOf(request)).toBe(group)
        expect(adapterReviewGroupOf).toHaveBeenCalledWith(request)
    })

    it('shows `txs` on a chain with no planner', () => {
        expect(reviewGroupOf(request)).toEqual({ transactions: txs })
    })

    it('shows the following transactions after `txs` and marks only `txs` signable', () => {
        const following = [
            makeUnsignedTransaction('FROM'),
            makeUnsignedTransaction('FROM'),
        ]
        const batch: TransactionSignRequest = {
            ...request,
            followingTxs: following,
        }

        const group = reviewGroupOf(batch)

        expect(group.transactions).toEqual([...txs, ...following])
        expect(group.signableIndices).toEqual([0])
        // The signing sheet's display cache compares these arrays by identity.
        expect(reviewGroupOf(batch)).toBe(group)
    })
})
