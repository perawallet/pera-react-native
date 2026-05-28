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

import React, { forwardRef, useImperativeHandle, useRef } from 'react'
import { StyleSheet } from 'react-native'
import { FlashList, FlashListProps, FlashListRef } from '@shopify/flash-list'
import { useBottomSheetScrollableCreator } from '@gorhom/bottom-sheet'
import { useSafeAreaInsets } from 'react-native-safe-area-context'

import { PWView } from '../PWView'
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
    /**
     * Card-list preset for lists of self-contained cards (account pickers,
     * rekey targets, …): separates cards with a plain `md` gap instead of the
     * default inset row divider.
     */
    cardLayout?: boolean
}

/**
 * Default separator for plain row lists: a hairline divider inset to the row
 * content (past the leading icon) with `md` breathing room above and below.
 */
const ListSeparator = () => {
    const styles = useStyles()

    return <PWView style={styles.itemSeparator} />
}

/** Card-list separator: a plain `md` gap, no divider line. */
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
            ...props
        },
        ref,
    ) => {
        const innerRef = useRef<FlashListRef<unknown>>(null)
        const insets = useSafeAreaInsets()
        // A caller's bottom padding becomes the gap *above* the safe-area inset
        // for in-sheet lists (paddingVertical counts too, since it implies a
        // bottom). Falls back to the `xl` default inside the style.
        const flatContentStyle = StyleSheet.flatten(contentContainerStyle) ?? {}
        const callerBottomGap =
            typeof flatContentStyle.paddingBottom === 'number'
                ? flatContentStyle.paddingBottom
                : typeof flatContentStyle.paddingVertical === 'number'
                  ? flatContentStyle.paddingVertical
                  : undefined
        const styles = useStyles({
            bottomInset: insets.bottom,
            bottomGap: callerBottomGap,
        })
        const BottomSheetScrollable = useBottomSheetScrollableCreator()

        useImperativeHandle(ref, () => ({
            scrollToOffset: params => innerRef.current?.scrollToOffset(params),
            scrollToIndex: params => {
                void innerRef.current?.scrollToIndex(params)
            },
            scrollToEnd: options => innerRef.current?.scrollToEnd(options),
        }))

        const fillEmpty =
            (props.data?.length ?? 0) === 0 && props.ListEmptyComponent != null

        // Vertical lists get a default separator: a plain gap for card lists,
        // an inset row divider otherwise. A caller-supplied separator wins;
        // pass `ItemSeparatorComponent={null}` for flush rows.
        const defaultSeparator = cardLayout ? CardSeparator : ListSeparator
        const resolvedSeparator =
            props.horizontal === true
                ? ItemSeparatorComponent
                : ItemSeparatorComponent === undefined
                  ? defaultSeparator
                  : ItemSeparatorComponent

        const flashProps: FlashListProps<unknown> = {
            ...props,
            showsVerticalScrollIndicator,
            showsHorizontalScrollIndicator,
            ItemSeparatorComponent: resolvedSeparator,
            contentContainerStyle: [
                props.horizontal === true || fillEmpty ? null : styles.content,
                fillEmpty ? styles.fillEmpty : null,
                contentContainerStyle,
                // Owns the bottom safe-area inset for in-sheet scroll lists;
                // appended last so it wins over a caller's paddingBottom.
                inBottomSheet && !fillEmpty && props.horizontal !== true
                    ? styles.sheetBottomInset
                    : null,
            ],
        }

        if (inBottomSheet) {
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
