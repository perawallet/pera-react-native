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

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { act, renderHook } from '@testing-library/react'
import { useChartPeriodSelection } from '../useChartPeriodSelection'

const mockHaptics = vi.hoisted(() => ({ selection: vi.fn() }))

vi.mock('@hooks/useHaptics', () => ({
    useHaptics: () => mockHaptics,
}))

vi.mock('@hooks/useLanguage')

describe('useChartPeriodSelection', () => {
    beforeEach(() => {
        mockHaptics.selection.mockClear()
    })

    it('plays the selection haptic when a different period is chosen', () => {
        const onChange = vi.fn()
        const { result } = renderHook(() =>
            useChartPeriodSelection({ value: 'one-week', onChange }),
        )

        act(() => {
            result.current.handlePressed('one-month')
        })

        expect(mockHaptics.selection).toHaveBeenCalledTimes(1)
        expect(onChange).toHaveBeenCalledWith('one-month')
    })

    it('stays silent when the active period is pressed again', () => {
        const onChange = vi.fn()
        const { result } = renderHook(() =>
            useChartPeriodSelection({ value: 'one-week', onChange }),
        )

        act(() => {
            result.current.handlePressed('one-week')
        })

        expect(mockHaptics.selection).not.toHaveBeenCalled()
        expect(onChange).not.toHaveBeenCalled()
    })
})
