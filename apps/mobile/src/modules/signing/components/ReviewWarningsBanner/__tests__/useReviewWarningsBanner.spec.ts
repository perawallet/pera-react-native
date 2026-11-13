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

    it('asks again when a high-risk item arrives after the user acknowledged', () => {
        const { result, rerender } = renderHook(
            ({ items }) => useReviewWarningsBanner(items),
            { initialProps: { items: [item('fee', true)] } },
        )
        act(() => result.current.toggleAcknowledged())
        expect(result.current.isAcknowledged).toBe(true)

        rerender({ items: [item('failure', true), item('fee', true)] })

        expect(result.current.isAcknowledged).toBe(false)
    })

    it('keeps the acknowledgement when an advisory item arrives', () => {
        const { result, rerender } = renderHook(
            ({ items }) => useReviewWarningsBanner(items),
            { initialProps: { items: [item('fee', true)] } },
        )
        act(() => result.current.toggleAcknowledged())

        rerender({ items: [item('fee', true), item('note')] })

        expect(result.current.isAcknowledged).toBe(true)
    })

    it('keeps the acknowledgement when a second banner mounts for the same request', () => {
        const first = renderHook(() =>
            useReviewWarningsBanner([item('fee', true)]),
        )
        act(() => first.result.current.toggleAcknowledged())

        const second = renderHook(() =>
            useReviewWarningsBanner([item('fee', true)]),
        )

        expect(second.result.current.isAcknowledged).toBe(true)
        expect(first.result.current.isAcknowledged).toBe(true)
    })

    it('keeps the acknowledgement across a remount of the same warnings', () => {
        const first = renderHook(() =>
            useReviewWarningsBanner([item('fee', true)]),
        )
        act(() => first.result.current.toggleAcknowledged())
        first.unmount()

        const again = renderHook(() =>
            useReviewWarningsBanner([item('fee', true)]),
        )

        expect(again.result.current.isAcknowledged).toBe(true)
    })
})
