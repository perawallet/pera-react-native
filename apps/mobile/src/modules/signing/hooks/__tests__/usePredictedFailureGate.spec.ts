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

import { describe, it, expect, beforeEach, vi, type Mock } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import { useSigningRequest } from '@perawallet/wallet-core-signing'
import {
    usePredictedFailureGate,
    usePredictedFailureAcknowledgementStore,
    usePredictedFailureFlagStore,
} from '../usePredictedFailureGate'

vi.mock('@perawallet/wallet-core-signing', () => ({
    useSigningRequest: vi.fn(),
}))

const setRequest = (id?: string) =>
    (useSigningRequest as Mock).mockReturnValue({
        currentRequest: id ? { id } : undefined,
    })

describe('usePredictedFailureGate', () => {
    beforeEach(() => {
        usePredictedFailureFlagStore.getState().resetState()
        usePredictedFailureAcknowledgementStore.getState().resetState()
        setRequest('request-1')
    })

    it('does not block a request nothing flagged', () => {
        const { result } = renderHook(() => usePredictedFailureGate())

        expect(result.current).toMatchObject({
            isFlagged: false,
            isConfirmBlocked: false,
        })
    })

    it('blocks a flagged request until it is acknowledged, and again once the acknowledgement is withdrawn', () => {
        const { result } = renderHook(() => usePredictedFailureGate())

        act(() => {
            usePredictedFailureFlagStore
                .getState()
                .setFlaggedRequestId('request-1')
        })
        expect(result.current.isConfirmBlocked).toBe(true)

        act(() => result.current.toggleAcknowledged())
        expect(result.current).toMatchObject({
            isAcknowledged: true,
            isConfirmBlocked: false,
        })

        act(() => result.current.toggleAcknowledged())
        expect(result.current.isConfirmBlocked).toBe(true)
    })

    it('starts the next request unacknowledged and unflagged', () => {
        const { result, rerender } = renderHook(() => usePredictedFailureGate())
        act(() => {
            usePredictedFailureFlagStore
                .getState()
                .setFlaggedRequestId('request-1')
        })
        act(() => result.current.toggleAcknowledged())

        setRequest('request-2')
        rerender()

        expect(result.current).toMatchObject({
            isFlagged: false,
            isAcknowledged: false,
            isConfirmBlocked: false,
        })
    })

    it('has nothing to acknowledge without a request', () => {
        setRequest(undefined)
        const { result } = renderHook(() => usePredictedFailureGate())

        act(() => result.current.toggleAcknowledged())

        expect(result.current.isAcknowledged).toBe(false)
        expect(
            usePredictedFailureAcknowledgementStore.getState()
                .acknowledgedRequestId,
        ).toBeUndefined()
    })
})
