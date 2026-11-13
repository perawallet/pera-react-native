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

import { act, renderHook } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import type { LayoutChangeEvent } from 'react-native'
import type { FilterOption } from '../FilterSelection'
import { chipRevealOffset, useFilterSelection } from '../useFilterSelection'

const VIEWPORT = 300

describe('chipRevealOffset', () => {
    it('returns null when the chip is fully visible', () => {
        expect(chipRevealOffset({ x: 50, width: 80 }, 0, VIEWPORT)).toBeNull()
    })

    it("returns the chip's left edge when it starts left of the visible area", () => {
        expect(chipRevealOffset({ x: 40, width: 80 }, 100, VIEWPORT)).toBe(40)
    })

    it('right-aligns a chip that ends past the visible area', () => {
        expect(chipRevealOffset({ x: 260, width: 100 }, 0, VIEWPORT)).toBe(60)
    })

    it('returns null before the viewport is measured', () => {
        expect(chipRevealOffset({ x: 260, width: 100 }, 0, 0)).toBeNull()
    })
})

const layoutOf = (x: number, width: number): LayoutChangeEvent =>
    ({
        nativeEvent: { layout: { x, y: 0, width, height: 30 } },
    }) as LayoutChangeEvent

const OPTIONS: FilterOption<string>[] = [
    { value: 'all', label: 'All' },
    { value: 'algo', label: 'Algorand' },
    { value: 'eth', label: 'Ethereum' },
    { value: 'base', label: 'Base' },
    { value: 'bnb', label: 'BNB Chain' },
]

// Three chips fit in the 300px viewport; the fourth ends at 360 and the fifth starts at 370.
const CHIP_LAYOUTS: [number, number][] = [
    [0, 50],
    [60, 90],
    [160, 90],
    [260, 100],
    [370, 100],
]

const setup = (selectedValue: string) => {
    const scrollTo = vi.fn()
    const hook = renderHook(
        ({ selected }) =>
            useFilterSelection({ options: OPTIONS, selectedValue: selected }),
        { initialProps: { selected: selectedValue } },
    )
    hook.result.current.scrollRef.current = { scrollTo }
    const layoutChips = () =>
        CHIP_LAYOUTS.forEach(([x, width], index) =>
            hook.result.current.chipLayoutHandlerOf(index)(layoutOf(x, width)),
        )
    const layoutViewport = () =>
        hook.result.current.handleViewportLayout(layoutOf(0, VIEWPORT))
    const measure = () =>
        act(() => {
            layoutViewport()
            layoutChips()
        })
    // react-native-web reports children's layout before the scroller's own.
    const measureChipsFirst = () =>
        act(() => {
            layoutChips()
            layoutViewport()
        })
    return { ...hook, scrollTo, measure, measureChipsFirst }
}

describe('useFilterSelection', () => {
    it('jumps to a selected chip that sits past the viewport once measured', () => {
        const { scrollTo, measure } = setup('bnb')

        measure()

        expect(scrollTo).toHaveBeenCalledWith({ x: 170, animated: false })
    })

    it('still reveals the selected chip when the chips report before the viewport', () => {
        const { scrollTo, measureChipsFirst } = setup('bnb')

        measureChipsFirst()

        expect(scrollTo).toHaveBeenCalledWith({ x: 170, animated: false })
    })

    it('leaves the row alone when the selected chip is already visible', () => {
        const { scrollTo, measure } = setup('algo')

        measure()

        expect(scrollTo).not.toHaveBeenCalled()
    })

    it('scrolls to a newly selected chip that is off-screen', () => {
        const { scrollTo, measure, rerender } = setup('all')
        measure()
        expect(scrollTo).not.toHaveBeenCalled()

        rerender({ selected: 'bnb' })

        expect(scrollTo).toHaveBeenCalledWith({ x: 170, animated: true })
    })

    it('scrolls back to the first chip when it is selected after the row moved right', () => {
        const { scrollTo, measure, rerender, result } = setup('bnb')
        measure()
        act(() =>
            result.current.handleScroll({
                nativeEvent: { contentOffset: { x: 170, y: 0 } },
            } as never),
        )
        scrollTo.mockClear()

        rerender({ selected: 'all' })

        expect(scrollTo).toHaveBeenCalledWith({ x: 0, animated: true })
    })

    it('does nothing when the selected value has no chip', () => {
        const { scrollTo, measure } = setup('missing')

        measure()

        expect(scrollTo).not.toHaveBeenCalled()
    })

    it("does not read a removed option's span as the chip that replaced it", () => {
        const scrollTo = vi.fn()
        const hook = renderHook(
            ({ options, selected }) =>
                useFilterSelection({ options, selectedValue: selected }),
            { initialProps: { options: OPTIONS, selected: 'all' } },
        )
        hook.result.current.scrollRef.current = { scrollTo }
        act(() => {
            hook.result.current.handleViewportLayout(layoutOf(0, VIEWPORT))
            CHIP_LAYOUTS.forEach(([x, width], index) =>
                hook.result.current.chipLayoutHandlerOf(index)(
                    layoutOf(x, width),
                ),
            )
        })
        const replaced = [
            ...OPTIONS.slice(0, 4),
            { value: 'arb', label: 'Arbitrum One' },
        ]

        hook.rerender({ options: replaced, selected: 'arb' })

        expect(scrollTo).not.toHaveBeenCalled()

        act(() =>
            hook.result.current.chipLayoutHandlerOf(4)(layoutOf(370, 120)),
        )

        expect(scrollTo).toHaveBeenCalledWith({ x: 190, animated: false })
    })
})
