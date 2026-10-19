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

import { useRef } from 'react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { act, renderHook } from '@testing-library/react'
import { PROMPT_REVEAL_MS } from '@constants/ui'
import type { Prompt } from '../usePromptContainer'
import { usePromptReveal } from '../usePromptReveal'

const { mockIsReducedMotion } = vi.hoisted(() => ({
    mockIsReducedMotion: vi.fn(() => false),
}))

// The global mock hands out a fresh shared value each render, which re-runs
// the swap effect and restarts its timer on every rerender.
vi.mock('react-native-reanimated', () => ({
    Easing: { bezier: () => () => undefined },
    useSharedValue: <T>(initial: T) => useRef({ value: initial }).current,
    useAnimatedStyle: <T>(worklet: () => T) => worklet(),
    useReducedMotion: () => mockIsReducedMotion(),
    withTiming: (toValue: number) => toValue,
}))

const makePrompt = (id: string): Prompt => ({
    id,
    priority: 0,
    isGate: false,
    component: () => null,
})

const promptA = makePrompt('a')
const promptB = makePrompt('b')
const promptC = makePrompt('c')

const dismissPrompt = vi.fn()
const hidePrompt = vi.fn()

const renderReveal = (nextPrompt?: Prompt) =>
    renderHook(
        ({ nextPrompt }: { nextPrompt?: Prompt }) =>
            usePromptReveal({ nextPrompt, dismissPrompt, hidePrompt }),
        { initialProps: { nextPrompt } },
    )

describe('usePromptReveal', () => {
    beforeEach(() => {
        vi.useFakeTimers()
        mockIsReducedMotion.mockReturnValue(false)
        dismissPrompt.mockClear()
        hidePrompt.mockClear()
    })

    afterEach(() => {
        vi.useRealTimers()
    })

    it('shows the first prompt immediately', () => {
        const { result } = renderReveal(promptA)

        expect(result.current.displayed).toBe(promptA)
    })

    it('clears the displayed prompt immediately when nothing is left', () => {
        const { result, rerender } = renderReveal(promptA)

        rerender({ nextPrompt: undefined })

        expect(result.current.displayed).toBeUndefined()
    })

    it('keeps the outgoing prompt until the exit animation has run', () => {
        const { result, rerender } = renderReveal(promptA)

        rerender({ nextPrompt: promptB })
        act(() => {
            vi.advanceTimersByTime(PROMPT_REVEAL_MS - 1)
        })
        expect(result.current.displayed).toBe(promptA)

        act(() => {
            vi.advanceTimersByTime(1)
        })
        expect(result.current.displayed).toBe(promptB)
    })

    it('swaps with no exit delay under reduced motion', () => {
        mockIsReducedMotion.mockReturnValue(true)
        const { result, rerender } = renderReveal(promptA)

        rerender({ nextPrompt: promptB })
        act(() => {
            vi.advanceTimersByTime(0)
        })

        expect(result.current.displayed).toBe(promptB)
    })

    it('drops a pending swap when the next prompt changes again', () => {
        const { result, rerender } = renderReveal(promptA)

        rerender({ nextPrompt: promptB })
        act(() => {
            vi.advanceTimersByTime(PROMPT_REVEAL_MS / 2)
        })
        rerender({ nextPrompt: promptC })
        act(() => {
            vi.advanceTimersByTime(PROMPT_REVEAL_MS / 2)
        })
        expect(result.current.displayed).toBe(promptA)

        act(() => {
            vi.advanceTimersByTime(PROMPT_REVEAL_MS / 2)
        })
        expect(result.current.displayed).toBe(promptC)
    })

    it('resolves the displayed prompt, not its successor, during an exit', () => {
        const { result, rerender } = renderReveal(promptA)
        rerender({ nextPrompt: promptB })

        result.current.handleDismiss()
        result.current.handleHide()

        expect(dismissPrompt).toHaveBeenCalledWith('a')
        expect(hidePrompt).toHaveBeenCalledWith('a')
    })
})
