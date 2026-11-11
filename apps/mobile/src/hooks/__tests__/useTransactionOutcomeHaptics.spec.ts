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
import { renderHook } from '@testing-library/react'

const mocks = vi.hoisted(() => {
    class SubmissionError extends Error {
        constructor(
            message: string,
            readonly classification: string = 'rejected-by-node',
            readonly txIds: string[] = [],
        ) {
            super(message)
        }
    }
    class UserRejectedSigningError extends Error {}
    return {
        SubmissionError,
        UserRejectedSigningError,
        txSuccess: vi.fn(),
        txError: vi.fn(),
        watchSubmissionOutcome: vi.fn(),
    }
})

vi.mock('@perawallet/wallet-core-signing', () => ({
    SubmissionError: mocks.SubmissionError,
    watchSubmissionOutcome: mocks.watchSubmissionOutcome,
}))

vi.mock('@hooks/useHaptics', () => ({
    useHaptics: () => ({
        txSuccess: mocks.txSuccess,
        txError: mocks.txError,
    }),
}))

import { useTransactionOutcomeHaptics } from '../useTransactionOutcomeHaptics'

describe('useTransactionOutcomeHaptics', () => {
    beforeEach(() => {
        vi.clearAllMocks()
    })

    it('plays txSuccess when the watched transaction confirms', () => {
        const { result } = renderHook(() => useTransactionOutcomeHaptics())

        result.current.watchOutcome('tx-1')
        const [txId, onOutcome] = mocks.watchSubmissionOutcome.mock.calls[0]
        // Watching alone is not a result: nothing plays until the outcome lands.
        expect(mocks.txSuccess).not.toHaveBeenCalled()
        expect(mocks.txError).not.toHaveBeenCalled()
        onOutcome('confirmed')

        expect(txId).toBe('tx-1')
        expect(mocks.txSuccess).toHaveBeenCalledTimes(1)
        expect(mocks.txError).not.toHaveBeenCalled()
    })

    it('plays txError when the watched transaction fails', () => {
        const { result } = renderHook(() => useTransactionOutcomeHaptics())

        result.current.watchOutcome('tx-1')
        mocks.watchSubmissionOutcome.mock.calls[0][1]('failed')

        expect(mocks.txError).toHaveBeenCalledTimes(1)
        expect(mocks.txSuccess).not.toHaveBeenCalled()
    })

    it('plays txError when the node rejected the submission', () => {
        const { result } = renderHook(() => useTransactionOutcomeHaptics())

        result.current.handleSubmitError(
            new mocks.SubmissionError('refused', 'rejected-by-node', ['tx-9']),
        )

        expect(mocks.txError).toHaveBeenCalledTimes(1)
        expect(mocks.watchSubmissionOutcome).not.toHaveBeenCalled()
    })

    it('watches the transaction instead of failing it when no node answered', () => {
        const { result } = renderHook(() => useTransactionOutcomeHaptics())

        result.current.handleSubmitError(
            new mocks.SubmissionError('no answer', 'unknown-outcome', [
                'tx-1',
                'tx-2',
            ]),
        )

        expect(mocks.txError).not.toHaveBeenCalled()
        expect(mocks.watchSubmissionOutcome).toHaveBeenCalledWith(
            'tx-2',
            expect.any(Function),
        )
        mocks.watchSubmissionOutcome.mock.calls[0][1]('confirmed')
        expect(mocks.txSuccess).toHaveBeenCalledTimes(1)
    })

    it('stays silent when no node answered and there is no txId to watch', () => {
        const { result } = renderHook(() => useTransactionOutcomeHaptics())

        result.current.handleSubmitError(
            new mocks.SubmissionError('no answer', 'unknown-outcome', []),
        )

        expect(mocks.txError).not.toHaveBeenCalled()
        expect(mocks.watchSubmissionOutcome).not.toHaveBeenCalled()
    })

    it('plays txError for a failure already final on chain', () => {
        const { result } = renderHook(() => useTransactionOutcomeHaptics())

        result.current.playFailure()

        expect(mocks.txError).toHaveBeenCalledTimes(1)
    })

    it('stays silent for a user cancel or any other error', () => {
        const { result } = renderHook(() => useTransactionOutcomeHaptics())

        result.current.handleSubmitError(
            new mocks.UserRejectedSigningError('cancelled'),
        )
        result.current.handleSubmitError(new Error('build failed'))

        expect(mocks.txError).not.toHaveBeenCalled()
    })
})
