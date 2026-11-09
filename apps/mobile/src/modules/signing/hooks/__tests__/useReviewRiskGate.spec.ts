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
    useFlagReviewRisk,
    useReviewRiskAcknowledgementStore,
    useReviewRiskFlagStore,
    useReviewRiskGate,
} from '../useReviewRiskGate'

vi.mock('@perawallet/wallet-core-signing', () => ({
    useSigningRequest: vi.fn(),
}))

const setRequest = (id?: string) =>
    (useSigningRequest as Mock).mockReturnValue({
        currentRequest: id ? { id } : undefined,
    })

const flagged = () => useReviewRiskFlagStore.getState().flaggedRequestId

describe('useReviewRiskGate', () => {
    beforeEach(() => {
        useReviewRiskFlagStore.getState().resetState()
        useReviewRiskAcknowledgementStore.getState().resetState()
        setRequest('request-1')
    })

    it('does not block a request nothing flagged', () => {
        const { result } = renderHook(() => useReviewRiskGate())

        expect(result.current).toMatchObject({
            isFlagged: false,
            isConfirmBlocked: false,
        })
    })

    it('blocks a flagged request until it is acknowledged, and again once the acknowledgement is withdrawn', () => {
        const { result } = renderHook(() => useReviewRiskGate())

        act(() => {
            useReviewRiskFlagStore.getState().setFlaggedRequestId('request-1')
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
        const { result, rerender } = renderHook(() => useReviewRiskGate())
        act(() => {
            useReviewRiskFlagStore.getState().setFlaggedRequestId('request-1')
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
        const { result } = renderHook(() => useReviewRiskGate())

        act(() => result.current.toggleAcknowledged())

        expect(result.current.isAcknowledged).toBe(false)
        expect(
            useReviewRiskAcknowledgementStore.getState().acknowledgedRequestId,
        ).toBeUndefined()
    })
})

describe('useFlagReviewRisk', () => {
    beforeEach(() => {
        useReviewRiskFlagStore.getState().resetState()
        useReviewRiskAcknowledgementStore.getState().resetState()
        setRequest('request-1')
    })

    it('flags the request while mounted and clears the flag on unmount', () => {
        const { unmount } = renderHook(() => useFlagReviewRisk(true))
        expect(flagged()).toBe('request-1')

        unmount()

        expect(flagged()).toBeUndefined()
    })

    it('leaves the request unflagged when nothing is high-risk', () => {
        renderHook(() => useFlagReviewRisk(false))

        expect(flagged()).toBeUndefined()
    })

    it('holds Confirm until the warning is acknowledged', () => {
        renderHook(() => useFlagReviewRisk(true))
        const gate = renderHook(() => useReviewRiskGate())
        expect(gate.result.current.isConfirmBlocked).toBe(true)

        act(() => gate.result.current.toggleAcknowledged())

        expect(gate.result.current.isConfirmBlocked).toBe(false)
    })

    it("leaves a newer request's flag alone when an older review unmounts late", () => {
        const { unmount } = renderHook(() => useFlagReviewRisk(true))
        act(() => {
            useReviewRiskFlagStore.getState().setFlaggedRequestId('request-2')
        })

        unmount()

        expect(flagged()).toBe('request-2')
    })
})

describe('useReviewRiskFlagStore seen ids', () => {
    beforeEach(() => {
        useReviewRiskFlagStore.getState().resetState()
    })

    it('reports an id as new once per request', () => {
        const { markSeen } = useReviewRiskFlagStore.getState()

        expect(markSeen('request-1', ['fee'])).toBe(true)
        expect(markSeen('request-1', ['fee'])).toBe(false)
        expect(markSeen('request-1', ['fee', 'failure'])).toBe(true)
    })

    it('forgets the ids when the request changes', () => {
        const { markSeen } = useReviewRiskFlagStore.getState()
        markSeen('request-1', ['fee'])

        expect(markSeen('request-2', ['fee'])).toBe(true)
        expect(useReviewRiskFlagStore.getState().seenIds).toEqual(['fee'])
    })
})
