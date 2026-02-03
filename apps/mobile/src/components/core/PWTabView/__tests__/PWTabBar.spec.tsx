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

import { render, fireEvent } from '@test-utils/render'
import { describe, it, expect, vi } from 'vitest'
import { PWTabBar } from '../PWTabBar'
import { Animated } from 'react-native'

describe('PWTabBar', () => {
    const mockNavigation = {
        navigate: vi.fn(),
        emit: vi.fn().mockReturnValue({ defaultPrevented: false }),
    }

    const mockState = {
        index: 0,
        routes: [
            { key: 'first', name: 'FirstTab' },
            { key: 'second', name: 'SecondTab' },
        ],
    }

    const mockDescriptors = {
        first: {
            options: { tabBarLabel: 'First Tab' },
        },
        second: {
            options: { title: 'Second Tab' },
        },
    }

    // Mock position as an Animated.Value
    const mockPosition = new Animated.Value(0)

    it('renders all tabs with correct labels', () => {
        const { getByText } = render(
            <PWTabBar
                state={mockState as any}
                descriptors={mockDescriptors as any}
                navigation={mockNavigation as any}
                position={mockPosition}
                layout={{ width: 300, height: 50 } as any}
                jumpTo={vi.fn() as any}
            />,
        )

        expect(getByText('First Tab')).toBeTruthy()
        expect(getByText('Second Tab')).toBeTruthy()
    })

    it('handles tab press', () => {
        const { getByText } = render(
            <PWTabBar
                state={mockState as any}
                descriptors={mockDescriptors as any}
                navigation={mockNavigation as any}
                position={mockPosition}
                layout={{ width: 300, height: 50 } as any}
                jumpTo={vi.fn() as any}
            />,
        )

        fireEvent.click(getByText('Second Tab'))

        expect(mockNavigation.emit).toHaveBeenCalledWith({
            type: 'tabPress',
            target: 'second',
            canPreventDefault: true,
        })
        expect(mockNavigation.navigate).toHaveBeenCalledWith('SecondTab')
    })
})
