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
import { Text } from 'react-native'
import type { SharedValue } from 'react-native-reanimated'
import { render, screen } from '@test-utils/render'

import { PWPager } from '../PWPager.web'

const pages = [
    <Text key='a'>Page A</Text>,
    <Text key='b'>Page B</Text>,
    <Text key='c'>Page C</Text>,
]

describe('PWPager (web)', () => {
    it('renders only the active page', () => {
        render(
            <PWPager
                index={1}
                onIndexChange={vi.fn()}
            >
                {pages}
            </PWPager>,
        )

        expect(screen.getByText('Page B')).toBeTruthy()
        expect(screen.queryByText('Page A')).toBeNull()
    })

    it('moves the offset to the selected index so the tab bar follows', () => {
        const offset = { value: 0 } as SharedValue<number>
        const { rerender } = render(
            <PWPager
                index={0}
                onIndexChange={vi.fn()}
                offset={offset}
            >
                {pages}
            </PWPager>,
        )

        rerender(
            <PWPager
                index={2}
                onIndexChange={vi.fn()}
                offset={offset}
            >
                {pages}
            </PWPager>,
        )

        expect(offset.value).toBe(2)
    })
})
