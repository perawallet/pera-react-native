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

import { requestRekeySignatures } from '../requestRekeySignatures'
import { RekeyError } from '../../errors'

import type {
    PeraSignedTransaction,
    PeraTransaction,
} from '@perawallet/wallet-core-blockchain'
import type { TransactionSignRequest } from '@perawallet/wallet-core-signing'

// The module under test only needs `compactSignedResults` at runtime;
// loading the real blockchain package would drag react-native-mmkv into
// this node test. The stub mirrors the real one-line implementation.
vi.mock('@perawallet/wallet-core-blockchain', () => ({
    compactSignedResults: (signed: unknown[]) =>
        signed.filter(tx => tx !== null),
}))

describe('requestRekeySignatures', () => {
    const source = { name: 'src-name', description: 'src-description' }
    const unsignedTxs = [
        { id: 'tx-1' } as unknown as PeraTransaction,
        { id: 'tx-2' } as unknown as PeraTransaction,
    ]

    beforeEach(() => {
        vi.clearAllMocks()
    })

    it('hands a headless transactions sign request to the pipeline with the supplied txs', () => {
        const addSignRequest = vi.fn()

        void requestRekeySignatures(addSignRequest, source, unsignedTxs)

        expect(addSignRequest).toHaveBeenCalledTimes(1)
        const request = addSignRequest.mock
            .calls[0][0] as TransactionSignRequest
        expect(request.type).toBe('transactions')
        expect(request.transport).toBe('callback')
        expect(request.sourceType).toBe('local')
        expect(request.txs).toEqual(unsignedTxs)
        expect(request.sourceMetadata).toEqual(source)
    })

    it('resolves with the signed bytes when the pipeline calls approve', async () => {
        let capturedRequest: TransactionSignRequest | undefined
        const addSignRequest = vi.fn((request: TransactionSignRequest) => {
            capturedRequest = request
        })
        const signed = [{ signed: true } as unknown as PeraSignedTransaction]

        const promise = requestRekeySignatures(
            addSignRequest,
            source,
            unsignedTxs,
        )

        await capturedRequest!.approve!(signed)

        await expect(promise).resolves.toEqual(signed)
    })

    it('rejects with a user_rejected RekeyError when the pipeline calls reject', async () => {
        let capturedRequest: TransactionSignRequest | undefined
        const addSignRequest = vi.fn((request: TransactionSignRequest) => {
            capturedRequest = request
        })

        const promise = requestRekeySignatures(
            addSignRequest,
            source,
            unsignedTxs,
        )

        await capturedRequest!.reject!()

        await expect(promise).rejects.toBeInstanceOf(RekeyError)
        await expect(promise).rejects.toMatchObject({ reason: 'user_rejected' })
    })

    it('rejects with a signing_failed RekeyError wrapping the original error', async () => {
        let capturedRequest: TransactionSignRequest | undefined
        const addSignRequest = vi.fn((request: TransactionSignRequest) => {
            capturedRequest = request
        })
        const originalError = new Error('signing transport failed')

        const promise = requestRekeySignatures(
            addSignRequest,
            source,
            unsignedTxs,
        )

        await capturedRequest!.error!(originalError)

        await expect(promise).rejects.toBeInstanceOf(RekeyError)
        await expect(promise).rejects.toMatchObject({
            reason: 'signing_failed',
            originalError,
        })
    })
})
