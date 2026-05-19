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
import { renderHook, act } from '@testing-library/react'
import type { Optional } from '@perawallet/wallet-core-shared'
import {
    useSignAndSubmitGroup,
    UserRejectedSigningError,
} from '../useSignAndSubmitGroup'
import type {
    PeraSignedTransaction,
    PeraTransaction,
} from '@perawallet/wallet-core-blockchain'
import type { TransactionSignRequest } from '../../models'

const mockAddSignRequest = vi.fn()
const mockSubmitAndAutoRefresh = vi.fn()

vi.mock('../useSigningRequest', () => ({
    useSigningRequest: () => ({
        addSignRequest: mockAddSignRequest,
    }),
}))

vi.mock('@perawallet/wallet-core-blockchain', () => ({
    useAlgorandClient: () => ({ client: { algod: {} } }),
    useTransactionEncoder: () => ({
        encodeSignedTransactions: vi.fn(arr =>
            arr.map(() => new Uint8Array([1])),
        ),
    }),
}))

vi.mock('../../pipeline/submission/submitAndAutoRefresh', () => ({
    submitAndAutoRefresh: (...args: unknown[]) =>
        mockSubmitAndAutoRefresh(...args),
}))

const fakeTxn = {
    sender: { toString: () => 'A' },
} as unknown as PeraTransaction

describe('useSignAndSubmitGroup', () => {
    beforeEach(() => {
        vi.clearAllMocks()
    })

    it('resolves with the algod txIds after the pipeline approves', async () => {
        mockSubmitAndAutoRefresh.mockResolvedValue(['tx1', 'tx2'])
        let captured: Optional<TransactionSignRequest>
        mockAddSignRequest.mockImplementation((r: TransactionSignRequest) => {
            captured = r
        })

        const { result } = renderHook(() => useSignAndSubmitGroup())

        const promise = act(async () =>
            result.current.submit({
                unsignedTxs: [fakeTxn, fakeTxn],
                source: { name: 'opt-in', description: 'test' },
            }),
        )

        // Drive the request: pretend the pipeline signed both txns.
        const signed = [
            { txn: fakeTxn, sig: new Uint8Array([1]) },
            { txn: fakeTxn, sig: new Uint8Array([2]) },
        ] as PeraSignedTransaction[]
        await captured?.approve?.(signed)

        await expect(promise).resolves.toEqual({ txIds: ['tx1', 'tx2'] })
        // Internal flows must stamp `sourceType: 'local'` (or omit it) —
        // never one of `INTERACTIVE_SOURCES`. Asserting the field guards
        // against a regression where the swap flow accidentally pulls in
        // the standard review/completion sheets.
        expect(captured?.transport).toBe('callback')
        expect(captured?.sourceType).toBe('local')
        expect(captured?.txs).toEqual([fakeTxn, fakeTxn])
        expect(mockSubmitAndAutoRefresh).toHaveBeenCalledTimes(1)
    })

    it('rejects with UserRejectedSigningError when reject() fires', async () => {
        let captured: Optional<TransactionSignRequest>
        mockAddSignRequest.mockImplementation((r: TransactionSignRequest) => {
            captured = r
        })

        const { result } = renderHook(() => useSignAndSubmitGroup())

        const promise = act(async () =>
            result.current.submit({
                unsignedTxs: [fakeTxn],
                source: { name: 'opt-out', description: 'test' },
            }),
        )

        await captured?.reject?.()

        await expect(promise).rejects.toBeInstanceOf(UserRejectedSigningError)
        expect(mockSubmitAndAutoRefresh).not.toHaveBeenCalled()
    })

    it('rejects with the original error when error() fires', async () => {
        let captured: Optional<TransactionSignRequest>
        mockAddSignRequest.mockImplementation((r: TransactionSignRequest) => {
            captured = r
        })
        const upstream = new Error('LedgerDisconnected')

        const { result } = renderHook(() => useSignAndSubmitGroup())

        const promise = act(async () =>
            result.current.submit({
                unsignedTxs: [fakeTxn],
                source: { name: 'send', description: 'test' },
            }),
        )

        await captured?.error?.(upstream)

        await expect(promise).rejects.toBe(upstream)
        expect(mockSubmitAndAutoRefresh).not.toHaveBeenCalled()
    })

    it('returns immediately with no submission when given an empty group', async () => {
        const { result } = renderHook(() => useSignAndSubmitGroup())

        const res = await act(async () =>
            result.current.submit({
                unsignedTxs: [],
                source: { name: 'no-op', description: 'test' },
            }),
        )

        expect(res).toEqual({ txIds: [] })
        expect(mockAddSignRequest).not.toHaveBeenCalled()
        expect(mockSubmitAndAutoRefresh).not.toHaveBeenCalled()
    })
})
