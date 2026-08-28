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
import { render, screen } from '@test-utils/render'

import { PWPager } from '../PWPager'

// The pan is reanimated worklets writing shared values, which this environment
// stubs out, and `onLayout` is ResizeObserver-driven under react-native-web so
// it can't be fired either. The drag and the measured-width path are therefore
// device-verified; what's covered here is what the gesture reads from React.
const renderPager = (props: Partial<Parameters<typeof PWPager>[0]> = {}) =>
    render(
        <PWPager
            index={0}
            onIndexChange={vi.fn()}
            {...props}
        >
            {[<Text key='a'>Page A</Text>, <Text key='b'>Page B</Text>]}
        </PWPager>,
    )

describe('PWPager', () => {
    it('mounts every page, so a neighbour is ready to drag to', () => {
        renderPager()

        expect(screen.getByText('Page A')).toBeTruthy()
        expect(screen.getByText('Page B')).toBeTruthy()
    })

    it('renders on the first frame rather than waiting to be measured', () => {
        renderPager()

        expect(screen.getByTestId('pw_pager')).toBeTruthy()
        expect(screen.getByText('Page A')).toBeTruthy()
    })

    it('settles a page without reporting an index change of its own', () => {
        const onIndexChange = vi.fn()
        renderPager({ index: 1, onIndexChange })

        expect(screen.getByText('Page B')).toBeTruthy()
        expect(onIndexChange).not.toHaveBeenCalled()
    })
})
