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

vi.mock('@hooks/useAppNavigation', () => ({
    useAppNavigation: () => ({ navigate: vi.fn() }),
}))

import { useAccountHeaderMenu } from '../useAccountHeaderMenu'

const CHART_LABEL = /portfolio\.(show|hide)_chart/

describe('useAccountHeaderMenu', () => {
    it('leads with the chart toggle by default', () => {
        const { result } = renderHook(() => useAccountHeaderMenu())

        expect(result.current.items[0]?.label).toMatch(CHART_LABEL)
    })

    it('drops the chart toggle where no chart renders and keeps the rest', () => {
        const { result } = renderHook(() =>
            useAccountHeaderMenu({ showChartToggle: false }),
        )

        const labels = result.current.items.map(item => item.label)
        expect(labels.some(label => CHART_LABEL.test(label))).toBe(false)
        expect(labels).toContain('search.title')
    })
})
