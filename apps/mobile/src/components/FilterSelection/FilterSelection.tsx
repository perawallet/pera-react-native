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

import type { StyleProp, ViewStyle } from 'react-native'
import { PWScrollView, PWText, PWTouchableOpacity } from '@components/core'
import { useStyles } from './styles'

export type FilterOption<T> = {
    value: T
    label: string
    testID?: string
}

export type FilterSelectionProps<T> = {
    options: FilterOption<T>[]
    selectedValue: T
    onSelect: (value: T) => void
    contentContainerStyle?: StyleProp<ViewStyle>
    testID?: string
}

/**
 * A single-select row of filter chips. The selected chip is filled
 * (secondary); the rest are outlined. The row lays out horizontally and
 * scrolls when the chips overflow the available width. Shared across the
 * onramp From sheet and history view.
 */
export const FilterSelection = <T,>({
    options,
    selectedValue,
    onSelect,
    contentContainerStyle,
    testID,
}: FilterSelectionProps<T>) => {
    const styles = useStyles()

    return (
        <PWScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={[styles.row, contentContainerStyle]}
            testID={testID}
        >
            {options.map(option => (
                <PWTouchableOpacity
                    key={String(option.value)}
                    onPress={() => onSelect(option.value)}
                    testID={option.testID}
                >
                    <PWText
                        style={
                            option.value === selectedValue
                                ? styles.activeChip
                                : styles.chip
                        }
                    >
                        {option.label}
                    </PWText>
                </PWTouchableOpacity>
            ))}
        </PWScrollView>
    )
}
