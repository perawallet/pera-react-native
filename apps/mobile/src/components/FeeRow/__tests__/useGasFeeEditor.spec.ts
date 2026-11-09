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
import { act, renderHook } from '@testing-library/react'
import { useGasFeeEditor } from '../useGasFeeEditor'

describe('useGasFeeEditor', () => {
    it('starts closed', () => {
        const { result } = renderHook(() =>
            useGasFeeEditor({ onPresetChange: vi.fn() }),
        )

        expect(result.current.isExpanded).toBe(false)
    })

    it('opens and closes as the toggle is called', () => {
        const { result } = renderHook(() =>
            useGasFeeEditor({ onPresetChange: vi.fn() }),
        )

        act(() => result.current.toggleExpanded())
        expect(result.current.isExpanded).toBe(true)

        act(() => result.current.toggleExpanded())
        expect(result.current.isExpanded).toBe(false)
    })

    it('reports the chosen speed once and closes the list', () => {
        const onPresetChange = vi.fn()
        const { result } = renderHook(() => useGasFeeEditor({ onPresetChange }))
        act(() => result.current.toggleExpanded())

        act(() => result.current.selectPreset('fast'))

        expect(onPresetChange).toHaveBeenCalledTimes(1)
        expect(onPresetChange).toHaveBeenCalledWith('fast')
        expect(result.current.isExpanded).toBe(false)
    })

    it('closes and reports again when the speed in use is chosen', () => {
        const onPresetChange = vi.fn()
        const { result } = renderHook(() => useGasFeeEditor({ onPresetChange }))
        act(() => result.current.toggleExpanded())

        act(() => result.current.selectPreset('normal'))

        expect(onPresetChange).toHaveBeenCalledWith('normal')
        expect(result.current.isExpanded).toBe(false)
    })
})
