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

import { describe, it, expect, vi, beforeEach } from 'vitest'

import { requestDelegationSignatures } from '../requestDelegationSignatures'
import { DelegationError } from '../../errors'

import type {
    SignedTransaction,
    UnsignedTransaction,
} from '@perawallet/wallet-core-chain-contract'
import type { UnsignedTransactionSignRequest } from '@perawallet/wallet-core-signing'

describe('requestDelegationSignatures', () => {
    const source = { name: 'src-name', description: 'src-description' }
    const unsignedTxs = [
        { id: 'tx-1' } as unknown as UnsignedTransaction,
        { id: 'tx-2' } as unknown as UnsignedTransaction,
    ]

    beforeEach(() => {
        vi.clearAllMocks()
    })

    it('hands a headless transactions sign request to the pipeline with the supplied txs', () => {
        const addSignRequest = vi.fn()

        void requestDelegationSignatures(addSignRequest, source, unsignedTxs)

        expect(addSignRequest).toHaveBeenCalledTimes(1)
        const request = addSignRequest.mock
            .calls[0][0] as UnsignedTransactionSignRequest
        expect(request.type).toBe('transactions')
        expect(request).not.toHaveProperty('chainId')
        expect(request.transport).toBe('callback')
        expect(request.sourceType).toBe('local')
        expect(request.txs).toEqual(unsignedTxs)
        expect(request.sourceMetadata).toEqual(source)
    })

    it('resolves with the signed bytes when the pipeline calls approve', async () => {
        let capturedRequest: UnsignedTransactionSignRequest | undefined
        const addSignRequest = vi.fn(
            (request: UnsignedTransactionSignRequest) => {
                capturedRequest = request
            },
        )
        const signed = [{ signed: true } as unknown as SignedTransaction]

        const promise = requestDelegationSignatures(
            addSignRequest,
            source,
            unsignedTxs,
        )

        await capturedRequest!.approve!(signed)

        await expect(promise).resolves.toEqual(signed)
    })

    it('drops padded null slots from the signed result', async () => {
        let capturedRequest: UnsignedTransactionSignRequest | undefined
        const addSignRequest = vi.fn(
            (request: UnsignedTransactionSignRequest) => {
                capturedRequest = request
            },
        )
        const signedA = { signed: true } as unknown as SignedTransaction

        const promise = requestDelegationSignatures(
            addSignRequest,
            source,
            unsignedTxs,
        )

        await capturedRequest!.approve!([signedA, null])

        await expect(promise).resolves.toEqual([signedA])
    })

    it('rejects with a user_rejected DelegationError when the pipeline calls reject', async () => {
        let capturedRequest: UnsignedTransactionSignRequest | undefined
        const addSignRequest = vi.fn(
            (request: UnsignedTransactionSignRequest) => {
                capturedRequest = request
            },
        )

        const promise = requestDelegationSignatures(
            addSignRequest,
            source,
            unsignedTxs,
        )

        await capturedRequest!.reject!()

        await expect(promise).rejects.toBeInstanceOf(DelegationError)
        await expect(promise).rejects.toMatchObject({ reason: 'user_rejected' })
    })

    it('rejects with a signing_failed DelegationError wrapping the original error', async () => {
        let capturedRequest: UnsignedTransactionSignRequest | undefined
        const addSignRequest = vi.fn(
            (request: UnsignedTransactionSignRequest) => {
                capturedRequest = request
            },
        )
        const originalError = new Error('signing transport failed')

        const promise = requestDelegationSignatures(
            addSignRequest,
            source,
            unsignedTxs,
        )

        await capturedRequest!.error!(originalError)

        await expect(promise).rejects.toBeInstanceOf(DelegationError)
        await expect(promise).rejects.toMatchObject({
            reason: 'signing_failed',
            originalError,
        })
    })
})
