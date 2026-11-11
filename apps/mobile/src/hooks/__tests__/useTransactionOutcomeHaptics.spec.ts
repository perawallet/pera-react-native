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
    }
})

vi.mock('@perawallet/wallet-core-signing', () => ({
    SubmissionError: mocks.SubmissionError,
    UserRejectedSigningError: mocks.UserRejectedSigningError,
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

    it('plays txSuccess on playSuccess', () => {
        const { result } = renderHook(() => useTransactionOutcomeHaptics())

        result.current.playSuccess()

        expect(mocks.txSuccess).toHaveBeenCalledTimes(1)
        expect(mocks.txError).not.toHaveBeenCalled()
    })

    it('plays txError when the node rejected the submission', () => {
        const { result } = renderHook(() => useTransactionOutcomeHaptics())

        result.current.handleSubmitError(
            new mocks.SubmissionError('refused', 'rejected-by-node'),
        )

        expect(mocks.txError).toHaveBeenCalledTimes(1)
    })

    it('plays txError for a failure already final on chain', () => {
        const { result } = renderHook(() => useTransactionOutcomeHaptics())

        result.current.playFailure()

        expect(mocks.txError).toHaveBeenCalledTimes(1)
    })

    it('plays txError for a failure before the network saw it', () => {
        const { result } = renderHook(() => useTransactionOutcomeHaptics())

        result.current.handleSubmitError(new Error('build failed'))

        expect(mocks.txError).toHaveBeenCalledTimes(1)
    })

    it('stays silent for no answer or a user cancel', () => {
        const { result } = renderHook(() => useTransactionOutcomeHaptics())

        result.current.handleSubmitError(
            new mocks.SubmissionError('no answer', 'unknown-outcome'),
        )
        result.current.handleSubmitError(
            new mocks.UserRejectedSigningError('cancelled'),
        )

        expect(mocks.txError).not.toHaveBeenCalled()
        expect(mocks.txSuccess).not.toHaveBeenCalled()
    })
})
