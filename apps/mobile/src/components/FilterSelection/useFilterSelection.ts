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

import { useCallback, useEffect, useRef, type RefObject } from 'react'
import type {
    LayoutChangeEvent,
    NativeScrollEvent,
    NativeSyntheticEvent,
} from 'react-native'
import type { PWScrollViewRef } from '@components/core'
import type { Nullable } from '@perawallet/wallet-core-shared'
import type { FilterOption } from './FilterSelection'

/** A chip's position and width (px) inside the row's scrolled content. */
export type ChipSpan = { x: number; width: number }

/**
 * The scroll x (px) that brings the chip fully into view, or null when it
 * already is, or the row isn't measured yet.
 */
export const chipRevealOffset = (
    chip: ChipSpan,
    scrollX: number,
    viewportWidth: number,
): Nullable<number> => {
    if (viewportWidth <= 0) {
        return null
    }
    if (chip.x < scrollX) {
        return chip.x
    }
    const chipRight = chip.x + chip.width
    if (chipRight > scrollX + viewportWidth) {
        return chipRight - viewportWidth
    }
    return null
}

export type UseFilterSelectionParams<T> = {
    options: FilterOption<T>[]
    selectedValue: T
}

export type UseFilterSelectionResult = {
    scrollRef: RefObject<Nullable<PWScrollViewRef>>
    handleViewportLayout: (event: LayoutChangeEvent) => void
    handleScroll: (event: NativeSyntheticEvent<NativeScrollEvent>) => void
    chipLayoutHandlerOf: (index: number) => (event: LayoutChangeEvent) => void
}

export const useFilterSelection = <T>({
    options,
    selectedValue,
}: UseFilterSelectionParams<T>): UseFilterSelectionResult => {
    const scrollRef = useRef<Nullable<PWScrollViewRef>>(null)
    const chipSpansRef = useRef(new Map<T, ChipSpan>())
    const viewportWidthRef = useRef(0)
    const scrollXRef = useRef(0)

    const selectedIndex = options.findIndex(
        option => option.value === selectedValue,
    )
    const selectedValueRef = useRef(selectedValue)
    selectedValueRef.current = selectedValue

    // Keyed by value, not index: a span left by an option that has since gone
    // would otherwise be read as the chip now at its index.
    useEffect(() => {
        const values = new Set(options.map(option => option.value))
        for (const value of chipSpansRef.current.keys()) {
            if (!values.has(value)) {
                chipSpansRef.current.delete(value)
            }
        }
    }, [options])

    const revealSelected = useCallback((animated: boolean) => {
        const chip = chipSpansRef.current.get(selectedValueRef.current)
        if (!chip) {
            return
        }
        const x = chipRevealOffset(
            chip,
            scrollXRef.current,
            viewportWidthRef.current,
        )
        if (x !== null) {
            scrollRef.current?.scrollTo({ x, animated })
        }
    }, [])

    // The selection outlives the row, which remounts at x=0: layout-driven
    // reveals jump there, only a changed selection animates.
    useEffect(() => {
        revealSelected(true)
    }, [selectedIndex, revealSelected])

    const handleViewportLayout = useCallback(
        (event: LayoutChangeEvent) => {
            viewportWidthRef.current = event.nativeEvent.layout.width
            revealSelected(false)
        },
        [revealSelected],
    )

    const handleScroll = useCallback(
        (event: NativeSyntheticEvent<NativeScrollEvent>) => {
            scrollXRef.current = event.nativeEvent.contentOffset.x
        },
        [],
    )

    const chipLayoutHandlerOf = useCallback(
        (index: number) => (event: LayoutChangeEvent) => {
            const value = options[index]?.value
            if (value === undefined) {
                return
            }
            const { x, width } = event.nativeEvent.layout
            chipSpansRef.current.set(value, { x, width })
            if (value === selectedValueRef.current) {
                revealSelected(false)
            }
        },
        [options, revealSelected],
    )

    return {
        scrollRef,
        handleViewportLayout,
        handleScroll,
        chipLayoutHandlerOf,
    }
}
