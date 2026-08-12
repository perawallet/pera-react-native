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

import React, {
    forwardRef,
    useContext,
    useImperativeHandle,
    useRef,
} from 'react'
import { StyleSheet } from 'react-native'
import {
    FlashList,
    type FlashListProps,
    type FlashListRef,
} from '@shopify/flash-list'
import { useBottomSheetScrollableCreator } from '@gorhom/bottom-sheet'
import { useSafeAreaInsets } from 'react-native-safe-area-context'

import { PWView } from '../PWView'
import { PWInBottomSheetContext } from '../PWBottomSheet/inSheetContext'
import { useStyles } from './styles'

export type PWFlatListRef = {
    scrollToOffset: (params: { offset: number; animated?: boolean }) => void
    scrollToIndex: (params: {
        index: number
        animated?: boolean
        viewOffset?: number
        viewPosition?: number
    }) => void
    scrollToEnd: (options?: { animated?: boolean }) => void
}

export type PWFlatListProps<T> = FlashListProps<T> & {
    inBottomSheet?: boolean
    cardLayout?: boolean
}

/**
 * FlashList prepares only 250dp beyond the viewport by default — roughly a
 * third of a phone screen, so a fast fling outruns cell preparation and leaves
 * blank space until it catches up. Two screens' worth buys that headroom; the
 * cost is a slightly larger recycle pool, not more mounted rows.
 */
const DEFAULT_DRAW_DISTANCE = 1000

const ListSeparator = () => {
    const styles = useStyles()

    return <PWView style={styles.itemSeparator} />
}

const CardSeparator = () => {
    const styles = useStyles()

    return <PWView style={styles.cardSeparator} />
}

export const PWFlatList = forwardRef<PWFlatListRef, PWFlatListProps<unknown>>(
    (
        {
            inBottomSheet,
            cardLayout,
            ItemSeparatorComponent,
            contentContainerStyle,
            showsVerticalScrollIndicator = false,
            showsHorizontalScrollIndicator = false,
            drawDistance = DEFAULT_DRAW_DISTANCE,
            // RN's default ('never') makes the first tap dismiss the keyboard
            // instead of hitting the row; 'handled' lets the row receive it.
            keyboardShouldPersistTaps = 'handled',
            ...props
        },
        ref,
    ) => {
        const innerRef = useRef<FlashListRef<unknown>>(null)
        const insets = useSafeAreaInsets()
        const styles = useStyles({ bottomInset: insets.bottom })
        const BottomSheetScrollable = useBottomSheetScrollableCreator()

        // Auto-detect a surrounding sheet: a missing flag silently breaks
        // scrolling, so the gesture can't cooperate with the sheet pan.
        const isInSheet = useContext(PWInBottomSheetContext)
        const isInBottomSheet = inBottomSheet ?? isInSheet

        useImperativeHandle(ref, () => ({
            scrollToOffset: params => innerRef.current?.scrollToOffset(params),
            scrollToIndex: params => {
                void innerRef.current?.scrollToIndex(params)
            },
            scrollToEnd: options => innerRef.current?.scrollToEnd(options),
        }))

        const isHorizontal = props.horizontal === true
        const fillEmpty =
            (props.data?.length ?? 0) === 0 && props.ListEmptyComponent != null
        const isVerticalList = !isHorizontal && !fillEmpty

        const defaultSeparator = cardLayout ? CardSeparator : ListSeparator
        const resolvedSeparator = isHorizontal
            ? ItemSeparatorComponent
            : ItemSeparatorComponent === undefined
              ? defaultSeparator
              : ItemSeparatorComponent

        const flashProps: FlashListProps<unknown> = {
            ...props,
            showsVerticalScrollIndicator,
            showsHorizontalScrollIndicator,
            drawDistance,
            keyboardShouldPersistTaps,
            ItemSeparatorComponent: resolvedSeparator,
            contentContainerStyle: StyleSheet.flatten([
                isVerticalList && styles.content,
                fillEmpty && styles.fillEmpty,
                contentContainerStyle,
                isInBottomSheet && isVerticalList && styles.sheetBottomInset,
            ]),
        }

        if (isInBottomSheet) {
            return (
                <FlashList
                    {...flashProps}
                    ref={innerRef}
                    renderScrollComponent={BottomSheetScrollable}
                />
            )
        }

        return (
            <FlashList
                {...flashProps}
                ref={innerRef}
            />
        )
    },
) as <T>(
    props: PWFlatListProps<T> & React.RefAttributes<PWFlatListRef>,
) => React.ReactNode
