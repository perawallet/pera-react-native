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

import { describe, expect, it, vi } from 'vitest'
import { act, render } from '@test-utils/render'
import type { LayoutChangeEvent } from 'react-native'
import { FilterSelection, type FilterOption } from '../FilterSelection'

const mocks = vi.hoisted(() => ({
    scrollTo: vi.fn(),
    onViewportLayout: undefined as ((e: LayoutChangeEvent) => void) | undefined,
    onChipLayouts: [] as ((e: LayoutChangeEvent) => void)[],
}))

vi.mock('@hooks/useHaptics', () => ({
    useHaptics: () => ({ selection: vi.fn() }),
}))

// Hands the test the layout callbacks FilterSelection wires, and a scroller
// handle that records scrollTo, since jsdom never lays anything out.
vi.mock('@components/core', async importOriginal => {
    const React = await import('react')
    const actual = await importOriginal<object>()
    return {
        ...actual,
        PWScrollView: ({
            ref,
            onLayout,
            children,
        }: {
            ref?: React.Ref<unknown>
            onLayout?: (e: LayoutChangeEvent) => void
            children?: React.ReactNode
        }) => {
            mocks.onViewportLayout = onLayout
            React.useImperativeHandle(ref, () => ({
                scrollTo: mocks.scrollTo,
            }))
            return React.createElement('div', null, children)
        },
        PWTouchableOpacity: ({
            onLayout,
            children,
        }: {
            onLayout?: (e: LayoutChangeEvent) => void
            children?: React.ReactNode
        }) => {
            if (onLayout) mocks.onChipLayouts.push(onLayout)
            return React.createElement('div', null, children)
        },
    }
})

const layoutOf = (x: number, width: number): LayoutChangeEvent =>
    ({
        nativeEvent: { layout: { x, y: 0, width, height: 30 } },
    }) as LayoutChangeEvent

const OPTIONS: FilterOption<string>[] = [
    { value: 'a', label: 'A' },
    { value: 'b', label: 'B' },
]

describe('FilterSelection layout wiring', () => {
    it('scrolls the selected chip into view once the chips and then the row report their layout', () => {
        mocks.onChipLayouts.length = 0
        render(
            <FilterSelection
                options={OPTIONS}
                selectedValue='b'
                onSelect={vi.fn()}
            />,
        )

        act(() => {
            // react-native-web reports children before the scroller itself.
            mocks.onChipLayouts[0]?.(layoutOf(0, 100))
            mocks.onChipLayouts[1]?.(layoutOf(110, 100))
            mocks.onViewportLayout?.(layoutOf(0, 150))
        })

        expect(mocks.scrollTo).toHaveBeenCalledWith({
            x: 60,
            animated: false,
        })
    })
})
