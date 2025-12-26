/*
 Copyright 2022-2025 Pera Wallet, LDA
 Licensed under the Apache License, Version 2.0 (the "License");
 you may not use this file except in compliance with the License.
 You may obtain a copy of the License at http://www.apache.org/licenses/LICENSE-2.0
 Unless required by applicable law or agreed to in writing, software
 distributed under the License is distributed on an "AS IS" BASIS,
 WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 See the License for the specific language governing permissions and
 limitations under the License
 */

import { renderHook, act } from '@testing-library/react-native'
import { useChartInteraction } from '../chart-interaction'

describe('useChartInteraction', () => {
    it('should initialize with default period', () => {
        const { result } = renderHook(() => useChartInteraction())
        expect(result.current.period).toBe('one-week')
        expect(result.current.selectedPoint).toBe(null)
    })

    it('should initialize with provided period', () => {
        const { result } = renderHook(() => useChartInteraction('one-day'))
        expect(result.current.period).toBe('one-day')
    })

    it('should update period', () => {
        const { result } = renderHook(() => useChartInteraction())
        act(() => {
            result.current.setPeriod('one-month')
        })
        expect(result.current.period).toBe('one-month')
    })

    it('should update and clear selected point', () => {
        const { result } = renderHook(() => useChartInteraction<number>())
        const point = 123

        act(() => {
            result.current.setSelectedPoint(point)
        })
        expect(result.current.selectedPoint).toBe(point)

        act(() => {
            result.current.clearSelection()
        })
        expect(result.current.selectedPoint).toBe(null)
    })
})
