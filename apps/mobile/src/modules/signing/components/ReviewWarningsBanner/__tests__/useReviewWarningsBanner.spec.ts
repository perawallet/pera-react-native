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
    useReviewRiskAcknowledgementStore,
    useReviewRiskFlagStore,
} from '../../../hooks/useReviewRiskGate'
import type { ReviewWarningItem } from '../types'
import { useReviewWarningsBanner } from '../useReviewWarningsBanner'

vi.mock('@perawallet/wallet-core-signing', () => ({
    useSigningRequest: vi.fn(),
}))

const item = (id: string, isHighRisk = false): ReviewWarningItem => ({
    id,
    message: id,
    isHighRisk,
})

const flagged = () => useReviewRiskFlagStore.getState().flaggedRequestId

describe('useReviewWarningsBanner', () => {
    beforeEach(() => {
        useReviewRiskFlagStore.getState().resetState()
        useReviewRiskAcknowledgementStore.getState().resetState()
        ;(useSigningRequest as Mock).mockReturnValue({
            currentRequest: { id: 'request-1' },
        })
    })

    it('shows a single item in full and folds two or more', () => {
        const one = renderHook(() => useReviewWarningsBanner([item('a')]))
        const two = renderHook(() =>
            useReviewWarningsBanner([item('a'), item('b')]),
        )

        expect(one.result.current.isCollapsible).toBe(false)
        expect(two.result.current.isCollapsible).toBe(true)
    })

    it('leaves Confirm alone when every item is advisory', () => {
        const { result } = renderHook(() =>
            useReviewWarningsBanner([item('a'), item('b')]),
        )

        expect(result.current.hasHighRisk).toBe(false)
        expect(flagged()).toBeUndefined()
    })

    it('flags the request for a high-risk item and lets the user acknowledge it', () => {
        const { result } = renderHook(() =>
            useReviewWarningsBanner([item('a'), item('b', true)]),
        )
        expect(result.current.hasHighRisk).toBe(true)
        expect(flagged()).toBe('request-1')
        expect(result.current.isAcknowledged).toBe(false)

        act(() => result.current.toggleAcknowledged())

        expect(result.current.isAcknowledged).toBe(true)
    })

    it('clears the flag when the banner unmounts', () => {
        const { unmount } = renderHook(() =>
            useReviewWarningsBanner([item('a', true)]),
        )

        unmount()

        expect(flagged()).toBeUndefined()
    })
})
