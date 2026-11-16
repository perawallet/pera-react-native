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

import { describe, it, expect, vi } from 'vitest'
import { renderHook } from '@testing-library/react'
import { useHapticOnCrossing } from '../useHapticOnCrossing'

describe('useHapticOnCrossing', () => {
    it('plays when the value goes from false to true', () => {
        const play = vi.fn()
        const { rerender } = renderHook(
            ({ isCrossed }) => useHapticOnCrossing(isCrossed, play),
            { initialProps: { isCrossed: false } },
        )

        rerender({ isCrossed: true })

        expect(play).toHaveBeenCalledTimes(1)
    })

    it('stays silent while the value remains true', () => {
        const play = vi.fn()
        const { rerender } = renderHook(
            ({ isCrossed }) => useHapticOnCrossing(isCrossed, play),
            { initialProps: { isCrossed: false } },
        )

        rerender({ isCrossed: true })
        rerender({ isCrossed: true })
        rerender({ isCrossed: true })

        expect(play).toHaveBeenCalledTimes(1)
    })

    it('plays again after the value drops back and crosses again', () => {
        const play = vi.fn()
        const { rerender } = renderHook(
            ({ isCrossed }) => useHapticOnCrossing(isCrossed, play),
            { initialProps: { isCrossed: false } },
        )

        rerender({ isCrossed: true })
        rerender({ isCrossed: false })
        rerender({ isCrossed: true })

        expect(play).toHaveBeenCalledTimes(2)
    })

    it('counts a first render that is already true as a crossing', () => {
        const play = vi.fn()

        renderHook(() => useHapticOnCrossing(true, play))

        expect(play).toHaveBeenCalledTimes(1)
    })

    it('stays silent when the value never turns true', () => {
        const play = vi.fn()
        const { rerender } = renderHook(
            ({ isCrossed }) => useHapticOnCrossing(isCrossed, play),
            { initialProps: { isCrossed: false } },
        )

        rerender({ isCrossed: false })

        expect(play).not.toHaveBeenCalled()
    })
})
