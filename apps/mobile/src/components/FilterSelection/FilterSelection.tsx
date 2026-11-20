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

import type { ReactNode } from 'react'
import type { StyleProp, ViewStyle } from 'react-native'
import { useTheme } from '@rneui/themed'
import {
    getIconPixelSize,
    PWScrollView,
    PWText,
    PWTouchableOpacity,
    PWView,
} from '@components/core'
import { useHaptics } from '@hooks/useHaptics'
import { SCROLL_EVENT_THROTTLE } from '@constants/ui'
import { useStyles } from './styles'
import { useFilterSelection } from './useFilterSelection'

export type FilterOption<T> = {
    value: T
    label: string
    testID?: string
    /** Drawn before the label at the row's icon size (px). */
    renderIcon?: (size: number) => ReactNode
}

export type FilterSelectionProps<T> = {
    options: FilterOption<T>[]
    selectedValue: T
    onSelect: (value: T) => void
    contentContainerStyle?: StyleProp<ViewStyle>
    emphasizeSelection?: boolean
    showsHorizontalScrollIndicator?: boolean
    testID?: string
}

/**
 * A single-select row of filter chips. The selected chip is filled
 * (secondary); the rest are outlined. The row scrolls when the chips overflow
 * the available width.
 */
export const FilterSelection = <T,>({
    options,
    selectedValue,
    onSelect,
    contentContainerStyle,
    emphasizeSelection = false,
    showsHorizontalScrollIndicator = false,
    testID,
}: FilterSelectionProps<T>) => {
    const styles = useStyles()
    const { theme } = useTheme()
    const iconSize = getIconPixelSize(theme, 'sm')
    const haptics = useHaptics()
    const {
        scrollRef,
        handleViewportLayout,
        handleScroll,
        chipLayoutHandlerOf,
    } = useFilterSelection({ options, selectedValue })

    return (
        <PWScrollView
            ref={scrollRef}
            // Never a sheet scroller: gorhom would make this row the sheet's
            // active scrollable, lock it back to x=0 and strand the list's scroll.
            inBottomSheet={false}
            onLayout={handleViewportLayout}
            onScroll={handleScroll}
            scrollEventThrottle={SCROLL_EVENT_THROTTLE}
            horizontal
            showsHorizontalScrollIndicator={showsHorizontalScrollIndicator}
            contentContainerStyle={[styles.row, contentContainerStyle]}
            testID={testID}
        >
            {options.map((option, index) => {
                const isActive = option.value === selectedValue
                return (
                    <PWTouchableOpacity
                        key={String(option.value)}
                        onPress={() => {
                            if (!isActive) haptics.selection()
                            onSelect(option.value)
                        }}
                        onLayout={chipLayoutHandlerOf(index)}
                        testID={option.testID}
                        accessibilityRole='button'
                        accessibilityState={{ selected: isActive }}
                        style={[
                            styles.chip,
                            isActive && styles.activeChip,
                            isActive &&
                                emphasizeSelection &&
                                styles.emphasizedChip,
                        ]}
                    >
                        {option.renderIcon ? (
                            // Decorative: the label already names the option,
                            // so a labelled icon would be read out twice.
                            <PWView
                                accessibilityElementsHidden
                                importantForAccessibility='no-hide-descendants'
                            >
                                {option.renderIcon(iconSize)}
                            </PWView>
                        ) : null}
                        <PWText
                            style={[
                                isActive ? styles.activeLabel : styles.label,
                                isActive &&
                                    emphasizeSelection &&
                                    styles.emphasizedLabel,
                            ]}
                        >
                            {option.label}
                        </PWText>
                    </PWTouchableOpacity>
                )
            })}
        </PWScrollView>
    )
}
