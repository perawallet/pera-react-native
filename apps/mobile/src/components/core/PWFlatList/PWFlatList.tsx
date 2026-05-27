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
import { FlashList, FlashListProps, FlashListRef } from '@shopify/flash-list'
import { useBottomSheetScrollableCreator } from '@gorhom/bottom-sheet'

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
}

export const PWFlatList = forwardRef<PWFlatListRef, PWFlatListProps<unknown>>(
    ({ inBottomSheet, ...props }, ref) => {
        const innerRef = useRef<FlashListRef<unknown>>(null)
        const BottomSheetScrollable = useBottomSheetScrollableCreator()

        useImperativeHandle(ref, () => ({
            scrollToOffset: params => innerRef.current?.scrollToOffset(params),
            scrollToIndex: params => {
                void innerRef.current?.scrollToIndex(params)
            },
            scrollToEnd: options => innerRef.current?.scrollToEnd(options),
        }))

        if (inBottomSheet) {
            return (
                <FlashList
                    {...(props ?? {})}
                    ref={innerRef}
                    renderScrollComponent={BottomSheetScrollable}
                />
            )
        } else {
            return (
                <FlashList
                    {...(props ?? {})}
                    ref={innerRef}
                />
            )
        }
    },
) as <T>(
    props: PWFlatListProps<T> & React.RefAttributes<PWFlatListRef>,
) => React.ReactNode
