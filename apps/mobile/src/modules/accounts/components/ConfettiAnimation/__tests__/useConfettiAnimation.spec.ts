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
import { act, renderHook } from '@testing-library/react'
import { useConfettiAnimation } from '../useConfettiAnimation'

const RENDER_DELAY_MS = 500

describe('useConfettiAnimation', () => {
    beforeEach(() => {
        vi.useFakeTimers()
    })

    afterEach(() => {
        vi.useRealTimers()
    })

    it('shows the confetti once the render delay has passed', () => {
        const {result} = renderHook(() => useConfettiAnimation({play: true}))

        expect(result.current.isVisible).toBe(false)

        act(() => {
            vi.advanceTimersByTime(RENDER_DELAY_MS)
        })

        expect(result.current.isVisible).toBe(true)
    })

    it('hides the confetti and reports the end once it finishes', () => {
        const onFinish = vi.fn()
        const {result} = renderHook(() =>
            useConfettiAnimation({play: true, onFinish}),
        )

        act(() => {
            vi.advanceTimersByTime(RENDER_DELAY_MS)
        })

        act(() => {
            result.current.handleFinish()
        })

        expect(result.current.isVisible).toBe(false)
        expect(onFinish).toHaveBeenCalledOnce()
    })

    it('stays hidden while it is not asked to play', () => {
        const {result} = renderHook(() => useConfettiAnimation({play: false}))

        act(() => {
            vi.advanceTimersByTime(RENDER_DELAY_MS)
        })

        expect(result.current.isVisible).toBe(false)
    })
})
