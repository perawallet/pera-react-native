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
import { renderHook, act } from '@testing-library/react'

const pauseSync = vi.hoisted(() => vi.fn())
const resumeSync = vi.hoisted(() => vi.fn())
vi.mock('@perawallet/wallet-core-background', () => ({ pauseSync, resumeSync }))

import { useSyncPauseOnInteraction } from '../useSyncPauseOnInteraction'

const event = {} as never

describe('useSyncPauseOnInteraction', () => {
    beforeEach(() => {
        vi.clearAllMocks()
        vi.useFakeTimers()
    })

    afterEach(() => {
        vi.useRealTimers()
    })

    const setup = (isEnabled = true, handlers = {}) =>
        renderHook(() => useSyncPauseOnInteraction(isEnabled, handlers))

    it('pauses on drag start', () => {
        const { result } = setup()

        act(() => result.current.onScrollBeginDrag?.(event))

        expect(pauseSync).toHaveBeenCalledTimes(1)
        expect(resumeSync).not.toHaveBeenCalled()
    })

    // The bug this guards: releasing on end-of-drag frees sync while a flick is
    // still coasting, which is the part that janks most.
    it('keeps holding through momentum after the finger lifts', () => {
        const { result } = setup()

        act(() => result.current.onScrollBeginDrag?.(event))
        act(() => result.current.onScrollEndDrag?.(event))
        act(() => result.current.onMomentumScrollBegin?.(event))
        act(() => vi.advanceTimersByTime(1000))

        expect(resumeSync).not.toHaveBeenCalled()

        act(() => result.current.onMomentumScrollEnd?.(event))

        expect(resumeSync).toHaveBeenCalledTimes(1)
    })

    // A drag released without a flick produces no momentum event at all, so the
    // deferred release is the only thing that frees sync.
    it('releases after the grace period when no momentum follows', () => {
        const { result } = setup()

        act(() => result.current.onScrollBeginDrag?.(event))
        act(() => result.current.onScrollEndDrag?.(event))
        expect(resumeSync).not.toHaveBeenCalled()

        act(() => vi.advanceTimersByTime(150))

        expect(resumeSync).toHaveBeenCalledTimes(1)
    })

    // The service ref-counts across lists, so a list releasing a pause it does
    // not hold would decrement a different list's.
    it('never releases more than it acquired across a full gesture', () => {
        const { result } = setup()

        act(() => result.current.onScrollBeginDrag?.(event))
        act(() => result.current.onScrollEndDrag?.(event))
        act(() => result.current.onMomentumScrollBegin?.(event))
        act(() => result.current.onMomentumScrollEnd?.(event))
        // A stray extra end event must not double-release.
        act(() => result.current.onMomentumScrollEnd?.(event))

        expect(pauseSync).toHaveBeenCalledTimes(1)
        expect(resumeSync).toHaveBeenCalledTimes(1)
    })

    it('does not re-pause on repeated drag starts within one gesture', () => {
        const { result } = setup()

        act(() => result.current.onScrollBeginDrag?.(event))
        act(() => result.current.onScrollBeginDrag?.(event))

        expect(pauseSync).toHaveBeenCalledTimes(1)
    })

    it('releases a held pause on unmount', () => {
        const { result, unmount } = setup()

        act(() => result.current.onScrollBeginDrag?.(event))
        unmount()

        expect(resumeSync).toHaveBeenCalledTimes(1)
    })

    it('touches nothing and passes handlers through when disabled', () => {
        const onScrollBeginDrag = vi.fn()
        const { result } = setup(false, { onScrollBeginDrag })

        act(() => result.current.onScrollBeginDrag?.(event))

        expect(pauseSync).not.toHaveBeenCalled()
        expect(onScrollBeginDrag).toHaveBeenCalledTimes(1)
    })

    it('still calls the caller-supplied handlers when enabled', () => {
        const onScrollBeginDrag = vi.fn()
        const onMomentumScrollEnd = vi.fn()
        const { result } = setup(true, {
            onScrollBeginDrag,
            onMomentumScrollEnd,
        })

        act(() => result.current.onScrollBeginDrag?.(event))
        act(() => result.current.onMomentumScrollEnd?.(event))

        expect(onScrollBeginDrag).toHaveBeenCalledTimes(1)
        expect(onMomentumScrollEnd).toHaveBeenCalledTimes(1)
        expect(pauseSync).toHaveBeenCalledTimes(1)
        expect(resumeSync).toHaveBeenCalledTimes(1)
    })
})
