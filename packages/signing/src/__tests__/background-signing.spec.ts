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

import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { SignedTransaction } from '@perawallet/wallet-core-chain-contract'
import { signTransactionsInBackground } from '../background-signing'
import { UserRejectedSigningError } from '../hooks/useSignAndSubmitGroup'
import type { UnsignedTransactionSignRequest } from '../models'
import { useSigningStore } from '../store'
import { SECOND_CHAIN_SCOPE, makeUnsignedTransaction } from './transactions'

const { mockStorage } = vi.hoisted(() => ({
    mockStorage: {
        getItem: vi.fn(),
        setItem: vi.fn(),
        removeItem: vi.fn(),
    },
}))

vi.mock('@perawallet/wallet-extension-provider', () => ({
    getProvider: () => ({ keyValueStorage: mockStorage }),
}))

const SOURCE = { name: 'Batch', description: 'Next transaction' }
const signed: SignedTransaction = {
    scope: SECOND_CHAIN_SCOPE,
    id: '0xsigned',
    bytes: new Uint8Array([1]),
}

const queued = (): UnsignedTransactionSignRequest =>
    useSigningStore.getState()
        .pendingSignRequests[0] as UnsignedTransactionSignRequest

describe('signTransactionsInBackground', () => {
    beforeEach(() => {
        useSigningStore.getState().resetState()
    })

    it('Given transactions, when queued, then it is a headless request that hands back signed bytes', async () => {
        const txs = [makeUnsignedTransaction('FROM')]

        const result = signTransactionsInBackground(txs, SOURCE)

        expect(queued()).toMatchObject({
            type: 'transactions',
            sourceType: 'local',
            transport: 'callback',
            txs,
            sourceMetadata: SOURCE,
        })
        await queued().approve?.([signed])
        await expect(result).resolves.toEqual([signed])
    })

    it('Given an approved review, when queued, then the request names it', () => {
        const reviewApproval = { token: 'token', positions: [1] }

        void signTransactionsInBackground(
            [makeUnsignedTransaction('FROM')],
            SOURCE,
            reviewApproval,
        )

        expect(queued().reviewApproval).toBe(reviewApproval)
    })

    it('Given a queued request, when the user rejects it, then it rejects as a user rejection', async () => {
        const result = signTransactionsInBackground(
            [makeUnsignedTransaction('FROM')],
            SOURCE,
        )

        await queued().reject?.()

        await expect(result).rejects.toBeInstanceOf(UserRejectedSigningError)
    })

    it('Given a queued request, when signing fails, then it rejects with that error', async () => {
        const failure = new Error('keystore locked')
        const result = signTransactionsInBackground(
            [makeUnsignedTransaction('FROM')],
            SOURCE,
        )

        await queued().error?.(failure)

        await expect(result).rejects.toBe(failure)
    })

    it('Given a slot comes back unsigned, when approved, then it rejects', async () => {
        const result = signTransactionsInBackground(
            [makeUnsignedTransaction('FROM')],
            SOURCE,
        )

        await queued().approve?.([null])

        await expect(result).rejects.toThrow('unsigned')
    })
})
