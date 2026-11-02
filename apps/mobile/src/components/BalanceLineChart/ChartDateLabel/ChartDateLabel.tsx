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

import { useState } from 'react'
import Animated, {
    useAnimatedStyle,
    useSharedValue,
} from 'react-native-reanimated'
import { PWText } from '@components/core'
import {
    formatDatetime,
    type Nullable,
    type Optional,
} from '@perawallet/wallet-core-shared'
import {
    useChartPressSelection,
    type BalanceChartPressState,
} from '../useChartPressSelection'
import { useChartDateLabelStyles } from './styles'

import type { LayoutChangeEvent } from 'react-native'

type ChartDateLabelProps<T> = {
    pressState: BalanceChartPressState
    series: Optional<T[]>
    getDatetime: (item: T) => Date
}

// Owns its own selection state so a scrub re-renders only this label, never
// the CartesianChart beside it. Position and visibility follow the press state
// on the UI thread, centred on the marker and clamped inside the row.
export const ChartDateLabel = <T,>({
    pressState,
    series,
    getDatetime,
}: ChartDateLabelProps<T>) => {
    const styles = useChartDateLabelStyles()
    const [selected, setSelected] = useState<Nullable<T>>(null)
    useChartPressSelection(pressState, series, setSelected)

    const rowWidth = useSharedValue(0)
    const labelWidth = useSharedValue(0)

    const labelStyle = useAnimatedStyle(() => {
        const centred = pressState.x.position.value - labelWidth.value / 2
        const maxLeft = Math.max(rowWidth.value - labelWidth.value, 0)
        return {
            opacity: pressState.isActive.value ? 1 : 0,
            transform: [
                { translateX: Math.min(Math.max(centred, 0), maxLeft) },
            ],
        }
    })

    return (
        <Animated.View
            style={styles.row}
            onLayout={(event: LayoutChangeEvent) => {
                rowWidth.value = event.nativeEvent.layout.width
            }}
        >
            <Animated.View
                style={[styles.label, labelStyle]}
                onLayout={(event: LayoutChangeEvent) => {
                    labelWidth.value = event.nativeEvent.layout.width
                }}
            >
                <PWText
                    variant='caption'
                    style={styles.text}
                    numberOfLines={1}
                >
                    {selected ? formatDatetime(getDatetime(selected)) : ''}
                </PWText>
            </Animated.View>
        </Animated.View>
    )
}
