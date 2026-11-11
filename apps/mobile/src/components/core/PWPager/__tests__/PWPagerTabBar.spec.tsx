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
import { fireEvent, render, screen } from '@test-utils/render'
import { PWPagerTabBar } from '../PWPagerTabBar'

const mockHaptics = vi.hoisted(() => ({ selection: vi.fn() }))

vi.mock('@hooks/useHaptics', () => ({
    useHaptics: () => mockHaptics,
}))

const TABS = [
    { key: 'Overview', title: 'Overview' },
    { key: 'History', title: 'History' },
]

describe('PWPagerTabBar', () => {
    beforeEach(() => {
        mockHaptics.selection.mockClear()
    })

    it('plays the selection haptic and reports the index when another tab is pressed', () => {
        const onIndexChange = vi.fn()
        render(
            <PWPagerTabBar
                tabs={TABS}
                onIndexChange={onIndexChange}
                offset={{ value: 0 } as never}
            />,
        )

        fireEvent.click(screen.getByTestId('tab_history'))

        expect(mockHaptics.selection).toHaveBeenCalledTimes(1)
        expect(onIndexChange).toHaveBeenCalledWith(1)
    })

    it('reports the index without a haptic when the current tab is pressed', () => {
        const onIndexChange = vi.fn()
        render(
            <PWPagerTabBar
                tabs={TABS}
                onIndexChange={onIndexChange}
                offset={{ value: 0 } as never}
            />,
        )

        fireEvent.click(screen.getByTestId('tab_overview'))

        expect(mockHaptics.selection).not.toHaveBeenCalled()
        expect(onIndexChange).toHaveBeenCalledWith(0)
    })
})
