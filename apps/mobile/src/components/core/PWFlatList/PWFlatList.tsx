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
import { LegendList, LegendListProps, LegendListRef } from '@legendapp/list'
import { useBottomSheetScrollableCreator } from '@gorhom/bottom-sheet'
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

export type PWFlatListProps<T> = LegendListProps<T> & {
    inBottomSheet?: boolean
}

export const PWFlatList = forwardRef<PWFlatListRef, PWFlatListProps<unknown>>(
    (
        {
            inBottomSheet,
            contentContainerStyle,
            style,
            // Default to `'handled'` so taps on touchable rows fire normally
            // while taps on the scroll background still dismiss the keyboard;
            // RN's `'never'` default swallows the first tap when an input
            // above the list is focused. Mirrors PWScrollView.
            keyboardShouldPersistTaps = 'handled',
            // Drag the list to dismiss the keyboard, following the finger.
            keyboardDismissMode = 'interactive',
            ...props
        },
        ref,
    ) => {
        const styles = useStyles()
        const innerRef = useRef<LegendListRef>(null)
        const BottomSheetScrollable = useBottomSheetScrollableCreator()

        useImperativeHandle(ref, () => ({
            scrollToOffset: params => innerRef.current?.scrollToOffset(params),
            scrollToIndex: params => innerRef.current?.scrollToIndex(params),
            scrollToEnd: options => innerRef.current?.scrollToEnd(options),
        }))

        const keyboardProps = {
            keyboardShouldPersistTaps,
            keyboardDismissMode,
        }

        const mergedContentContainerStyle = props.horizontal
            ? [styles.gap, contentContainerStyle]
            : [
                  styles.gap,
                  styles.verticalContentContainer,
                  contentContainerStyle,
              ]

        // LegendList needs a bounded height to scroll vertically.
        const selfBounded =
            props.horizontal || props.scrollEnabled === false
        const outerStyle = selfBounded ? style : [styles.fill, style]

        if (inBottomSheet) {
            return (
                <LegendList
                    {...props}
                    {...keyboardProps}
                    ref={innerRef}
                    style={style}
                    contentContainerStyle={mergedContentContainerStyle}
                    renderScrollComponent={BottomSheetScrollable}
                />
            )
        }

        return (
            <LegendList
                {...props}
                {...keyboardProps}
                ref={innerRef}
                style={outerStyle}
                contentContainerStyle={mergedContentContainerStyle}
            />
        )
    },
) as <T>(
    props: PWFlatListProps<T> & React.RefAttributes<PWFlatListRef>,
) => React.ReactNode
