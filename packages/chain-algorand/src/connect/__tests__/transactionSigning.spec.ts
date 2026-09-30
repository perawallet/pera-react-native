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
import { renderHook } from '@testing-library/react'
import type { ExternalSignTxnTransport } from '@perawallet/wallet-core-connections'
import { useAlgorandTransactionSigning } from '../transactionSigning'

const mockResolve = vi.fn()
const mockEnqueue = vi.fn()

vi.mock('@perawallet/wallet-core-signing', () => ({
    useArc0001Resolver: () => mockResolve,
    useEnqueueArc0001SignRequest: () => mockEnqueue,
}))

// Only its identity matters to this file: `enqueue` must receive it untouched.
const transport = { transportId: 'c1' } as unknown as ExternalSignTxnTransport

const resolvedFixture = {
    allDecoded: [],
    toSign: [],
    signerOverrides: new Map(),
}

describe('useAlgorandTransactionSigning', () => {
    beforeEach(() => {
        mockResolve.mockReset()
        mockEnqueue.mockReset()
    })

    it('propagates a resolver throw synchronously, without enqueueing', () => {
        // `resolve` enforces ARC-0001 invariants (bad base64, an
        // unauthorized signer, a multisig slot...) by throwing; the caller
        // relies on that throw reaching it BEFORE anything is queued, so this
        // hook must not be `async` (which would flatten it into a rejection).
        const violation = new Error('Invalid base64 in transaction 0')
        mockResolve.mockImplementation(() => {
            throw violation
        })
        const { result } = renderHook(() => useAlgorandTransactionSigning())

        expect(() =>
            result.current(
                { group: [{ txn: 'bad' }], authorizedAccounts: ['AAAA'] },
                transport,
            ),
        ).toThrow(violation)
        expect(mockEnqueue).not.toHaveBeenCalled()
    })

    it('passes the group and an authorizedAddresses set to the resolver', () => {
        mockResolve.mockReturnValue(resolvedFixture)
        mockEnqueue.mockResolvedValue(null)
        const { result } = renderHook(() => useAlgorandTransactionSigning())
        const group = [{ txn: 'AA==' }]

        result.current(
            { group, authorizedAccounts: ['AAAA', 'BBBB'] },
            transport,
        )

        expect(mockResolve).toHaveBeenCalledWith(
            { transactions: group },
            { authorizedAddresses: new Set(['AAAA', 'BBBB']) },
        )
    })

    it('hands the resolved result and transport to enqueue untouched', () => {
        mockResolve.mockReturnValue(resolvedFixture)
        mockEnqueue.mockResolvedValue(null)
        const { result } = renderHook(() => useAlgorandTransactionSigning())

        result.current({ group: [], authorizedAccounts: [] }, transport)

        expect(mockEnqueue).toHaveBeenCalledWith(resolvedFixture, transport)
    })

    it('resolves with the enqueued request', async () => {
        mockResolve.mockReturnValue(resolvedFixture)
        const signRequest = { id: 'sr-1' }
        mockEnqueue.mockResolvedValue(signRequest)
        const { result } = renderHook(() => useAlgorandTransactionSigning())

        await expect(
            result.current({ group: [], authorizedAccounts: [] }, transport),
        ).resolves.toBe(signRequest)
    })
})
