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

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { renderHook } from '@testing-library/react'

const { mockClearMemoryCache } = vi.hoisted(() => ({
    mockClearMemoryCache: vi.fn(),
}))

vi.mock('expo-image', () => ({
    Image: { clearMemoryCache: mockClearMemoryCache },
}))

import { useImageMemoryReleaseOnHide } from '../useImageMemoryReleaseOnHide'

describe('useImageMemoryReleaseOnHide', () => {
    beforeEach(() => {
        vi.clearAllMocks()
        vi.useFakeTimers()
    })

    afterEach(() => {
        vi.useRealTimers()
    })

    it('keeps the cache while the surface stays visible', () => {
        const { rerender } = renderHook(
            ({ isVisible }) => useImageMemoryReleaseOnHide(isVisible),
            { initialProps: { isVisible: true } },
        )

        rerender({ isVisible: true })
        vi.runAllTimers()

        expect(mockClearMemoryCache).not.toHaveBeenCalled()
    })

    it('clears the memory cache once the release delay has passed after hiding', () => {
        const { rerender } = renderHook(
            ({ isVisible }) => useImageMemoryReleaseOnHide(isVisible),
            { initialProps: { isVisible: true } },
        )

        rerender({ isVisible: false })
        vi.advanceTimersByTime(499)
        expect(mockClearMemoryCache).not.toHaveBeenCalled()
        vi.advanceTimersByTime(1)

        expect(mockClearMemoryCache).toHaveBeenCalledTimes(1)
    })

    it('does not clear when a surface that was never visible stays hidden', () => {
        const { rerender } = renderHook(
            ({ isVisible }) => useImageMemoryReleaseOnHide(isVisible),
            { initialProps: { isVisible: false } },
        )

        rerender({ isVisible: false })
        vi.runAllTimers()

        expect(mockClearMemoryCache).not.toHaveBeenCalled()
    })

    it('clears after unmount only when it was visible', () => {
        renderHook(() => useImageMemoryReleaseOnHide(true)).unmount()
        vi.runAllTimers()
        expect(mockClearMemoryCache).toHaveBeenCalledTimes(1)

        mockClearMemoryCache.mockClear()
        renderHook(() => useImageMemoryReleaseOnHide(false)).unmount()
        vi.runAllTimers()
        expect(mockClearMemoryCache).not.toHaveBeenCalled()
    })
})
