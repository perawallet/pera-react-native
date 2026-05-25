/*
 Copyright 2022-2025 Pera Wallet, LDA
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
import { renderHook } from '@testing-library/react'

import type { Arc0001ResolveResult } from '@perawallet/wallet-core-blockchain'

import { useEnqueueArc0001SignRequest } from '../useEnqueueArc0001SignRequest'

const mockAddSignRequest = vi.fn()
const mockRemoveSignRequest = vi.fn()
const mockEncodeSignedTransaction = vi.fn(() => new Uint8Array([1, 2, 3, 4]))

vi.mock('../useSigningRequest', () => ({
    useSigningRequest: () => ({
        addSignRequest: mockAddSignRequest,
        removeSignRequest: mockRemoveSignRequest,
        clearLastFailedRequest: vi.fn(),
    }),
}))

vi.mock('@perawallet/wallet-core-blockchain', () => ({
    useTransactionEncoder: () => ({
        encodeSignedTransaction: mockEncodeSignedTransaction,
    }),
}))

vi.mock('@perawallet/wallet-core-shared', () => ({
    generateOrderedUniqueId: () => 'MOCK_ID',
    encodeToBase64: (bytes: Uint8Array) =>
        `b64(${Array.from(bytes).join(',')})`,
}))

const makeResolved = (
    toSignCount: number,
    totalCount: number,
): Arc0001ResolveResult => ({
    allDecoded: Array.from({ length: totalCount }, () => ({}) as any),
    toSign: Array.from({ length: toSignCount }, (_, i) => ({
        index: i,
        walletTxn: { txn: `txn-${i}` },
        decoded: {} as any,
        sender: `sender-${i}`,
        signer: { kind: 'single' as const, address: `sender-${i}` },
    })),
    signerOverrides: new Map(),
})

const makeTransport = () => ({
    sourceType: 'walletconnect' as const,
    transportId: 'test-transport-id',
    sourceMetadata: { name: 'Test' },
    respondWithResult: vi.fn(),
    respondWithReject: vi.fn(),
    respondWithError: vi.fn(),
})

describe('useEnqueueArc0001SignRequest', () => {
    beforeEach(() => {
        vi.clearAllMocks()
    })

    it('short-circuits to respondWithResult with all-nulls when nothing is signable', () => {
        const { result } = renderHook(() => useEnqueueArc0001SignRequest())
        const transport = makeTransport()

        result.current(makeResolved(0, 3), transport)

        expect(transport.respondWithResult).toHaveBeenCalledWith([
            null,
            null,
            null,
        ])
        expect(mockAddSignRequest).not.toHaveBeenCalled()
    })

    it('enqueues a TransactionSignRequest with the resolved subset', () => {
        const { result } = renderHook(() => useEnqueueArc0001SignRequest())
        const transport = makeTransport()
        const resolved = makeResolved(2, 3)

        result.current(resolved, transport)

        expect(mockAddSignRequest).toHaveBeenCalledWith(
            expect.objectContaining({
                id: 'MOCK_ID',
                type: 'transactions',
                transport: 'callback',
                sourceType: 'walletconnect',
                transportId: 'test-transport-id',
                sourceMetadata: { name: 'Test' },
                txs: expect.any(Array),
                groupContext: resolved.allDecoded,
                rawTransactionsBase64: ['txn-0', 'txn-1'],
            }),
        )
    })

    it('threads signableIndices so the UI can label signed/unsigned slots', () => {
        const { result } = renderHook(() => useEnqueueArc0001SignRequest())
        const transport = makeTransport()
        // 5-tx payload, wallet signs indices 0, 2, 4 (skipping 1 and 3)
        const resolved = {
            allDecoded: Array.from({ length: 5 }, () => ({}) as any),
            toSign: [0, 2, 4].map(i => ({
                index: i,
                walletTxn: { txn: `txn-${i}` },
                decoded: {} as any,
                sender: `s${i}`,
                signer: { kind: 'single' as const, address: `s${i}` },
            })),
            signerOverrides: new Map(),
        }

        result.current(resolved, transport)

        expect(mockAddSignRequest).toHaveBeenCalledWith(
            expect.objectContaining({
                signableIndices: [0, 2, 4],
            }),
        )
    })

    it('threads signerOverrides through only when non-empty', () => {
        const { result } = renderHook(() => useEnqueueArc0001SignRequest())
        const transport = makeTransport()
        const resolved = makeResolved(1, 1)
        resolved.signerOverrides.set(0, 'override-addr')

        result.current(resolved, transport)

        expect(mockAddSignRequest).toHaveBeenCalledWith(
            expect.objectContaining({
                signerOverrides: resolved.signerOverrides,
            }),
        )
    })

    it('omits signerOverrides when the map is empty', () => {
        const { result } = renderHook(() => useEnqueueArc0001SignRequest())
        const transport = makeTransport()

        result.current(makeResolved(1, 1), transport)

        const signRequest = mockAddSignRequest.mock.calls[0][0]
        expect(signRequest.signerOverrides).toBeUndefined()
    })

    it('approve callback pads result back to the original length with nulls', async () => {
        const { result } = renderHook(() => useEnqueueArc0001SignRequest())
        const transport = makeTransport()
        // index 0 signable, index 1 skipped, index 2 signable
        const resolved: Arc0001ResolveResult = {
            allDecoded: [{}, {}, {}] as any[],
            toSign: [
                {
                    index: 0,
                    walletTxn: { txn: 'A' },
                    decoded: {} as any,
                    sender: 's0',
                    signer: { kind: 'single', address: 's0' },
                },
                {
                    index: 2,
                    walletTxn: { txn: 'C' },
                    decoded: {} as any,
                    sender: 's2',
                    signer: { kind: 'single', address: 's2' },
                },
            ],
            signerOverrides: new Map(),
        }

        result.current(resolved, transport)
        const signRequest = mockAddSignRequest.mock.calls[0][0]
        await signRequest.approve([{ sig: 1 }, { sig: 2 }])

        expect(transport.respondWithResult).toHaveBeenCalledWith([
            'b64(1,2,3,4)',
            null,
            'b64(1,2,3,4)',
        ])
    })

    it('reject callback forwards to respondWithReject', async () => {
        const { result } = renderHook(() => useEnqueueArc0001SignRequest())
        const transport = makeTransport()

        result.current(makeResolved(1, 1), transport)
        await mockAddSignRequest.mock.calls[0][0].reject()

        expect(transport.respondWithReject).toHaveBeenCalledTimes(1)
    })

    it('error callback forwards the error AND removes the queued request', async () => {
        const { result } = renderHook(() => useEnqueueArc0001SignRequest())
        const transport = makeTransport()

        result.current(makeResolved(1, 1), transport)
        const signRequest = mockAddSignRequest.mock.calls[0][0]
        const incoming = new Error('boom')
        await signRequest.error(incoming)

        expect(transport.respondWithError).toHaveBeenCalledWith(incoming)
        expect(mockRemoveSignRequest).toHaveBeenCalledWith(signRequest)
    })
})
