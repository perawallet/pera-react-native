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

import {
    useCallback,
    useMemo,
    type ComponentType,
    type ReactNode,
} from 'react'
import { Pressable } from 'react-native'
import { PWView } from '@components/core'
import { SearchInputTrigger } from '@components/SearchInputTrigger'
import type { Maybe, Nullable } from '@perawallet/wallet-core-shared'
import {
    isHeaderSentinel,
    isSearchSentinel,
    isSeparatorSuppressed,
    type AugmentedItem,
} from '../useSearchableList'
import type {
    RenderItem,
    SearchableListSearchProps,
} from '../SearchableList'
import { useStyles } from '../styles'

const renderHeaderNode = (
    component: Maybe<React.ComponentType | React.ReactElement>,
): ReactNode => {
    if (component == null) {
        return null
    }
    if (typeof component === 'function') {
        const Component = component
        return <Component />
    }
    return component
}

type WrappedSeparatorProps = {
    leadingItem?: unknown
    trailingItem?: unknown
}

export type UseSearchableListFullProps<T> = {
    ListHeaderComponent?: Maybe<ComponentType | React.ReactElement>
    ListEmptyComponent?: Maybe<ComponentType | React.ReactElement>
    ListFooterComponent?: Maybe<ComponentType | React.ReactElement>
    CallerSeparator?: Maybe<ComponentType>
    renderItem?: RenderItem<T>
    searchValue?: string
    searchPlaceholder?: string
    SearchInputComponent: ComponentType<SearchableListSearchProps>
    searchAccessory?: ReactNode
    callerExtraData?: unknown
    isListEmpty: boolean
    searchFooterHeight: number
    currentValue: string
    showOverlay: boolean
    handleEnterSearch: () => void
    handleClearQuery: () => void
    toUserIndex: (index: number) => number
    handleHeaderLayout: (event: unknown) => void
}

export type UseSearchableListFullResult<T> = {
    augmentedFooter: ReactNode
    augmentedRenderItem: RenderItem<AugmentedItem<T>>
    augmentedSeparator: Nullable<ComponentType<unknown>>
    augmentedExtraData: unknown
}

export const useSearchableListFull = <T,>({
    ListHeaderComponent,
    ListEmptyComponent,
    ListFooterComponent,
    CallerSeparator,
    renderItem,
    searchValue,
    searchPlaceholder,
    SearchInputComponent,
    searchAccessory,
    callerExtraData,
    isListEmpty,
    searchFooterHeight,
    currentValue,
    showOverlay,
    handleEnterSearch,
    handleClearQuery,
    toUserIndex,
    handleHeaderLayout,
}: UseSearchableListFullProps<T>): UseSearchableListFullResult<T> => {
    const styles = useStyles()

    const augmentedFooter = useMemo(() => {
        const emptyComponent = isListEmpty
            ? renderHeaderNode(ListEmptyComponent)
            : null
        const callerFooter = renderHeaderNode(ListFooterComponent)

        // Empty list: host the empty component in a container sized to the
        // leftover viewport space (searchFooterHeight) and center it (to account for keyboard).
        if (emptyComponent != null) {
            return (
                <>
                    <PWView
                        style={[
                            styles.emptyFill,
                            searchFooterHeight > 0 && {
                                height: searchFooterHeight,
                            },
                        ]}
                    >
                        {emptyComponent}
                    </PWView>
                    {callerFooter}
                </>
            )
        }

        if (callerFooter == null && searchFooterHeight <= 0) {
            return null
        }
        return (
            <>
                {callerFooter}
                {searchFooterHeight > 0 && (
                    <PWView style={{ height: searchFooterHeight }} />
                )}
            </>
        )
    }, [
        ListEmptyComponent,
        ListFooterComponent,
        isListEmpty,
        searchFooterHeight,
        styles.emptyFill,
    ])

    const augmentedRenderItem = useCallback<RenderItem<AugmentedItem<T>>>(
        info => {
            if (isHeaderSentinel(info.item)) {
                return (
                    <PWView onLayout={handleHeaderLayout}>
                        {renderHeaderNode(ListHeaderComponent)}
                    </PWView>
                )
            }
            if (isSearchSentinel(info.item)) {
                // Display mirror: the same SearchInput so it looks identical to
                // the overlay, but non-interactive. Keyboard dismiss is off so
                // it doesn't fight handleEnterSearch focusing the overlay.
                return (
                    <PWView style={styles.searchSticky}>
                        {/* Bounds the clear hit area to the input, so it never
                            covers the accessory below. */}
                        <PWView>
                            <SearchInputTrigger
                                onPress={handleEnterSearch}
                                value={currentValue}
                                placeholder={searchPlaceholder}
                                SearchInputComponent={SearchInputComponent}
                                displayStyle={
                                    showOverlay
                                        ? styles.searchOverlayHidden
                                        : undefined
                                }
                                dismissKeyboardOnPress={false}
                                accessibilityElementsHidden
                                importantForAccessibility='no-hide-descendants'
                            />
                            {/* Transparent tap target over the visible clear (X):
                                clears in place without pinning. Rendered last so
                                it sits above the body Pressable. */}
                            {currentValue ? (
                                <Pressable
                                    style={styles.searchClearHitArea}
                                    onPress={handleClearQuery}
                                    accessibilityLabel='Clear search'
                                />
                            ) : null}
                        </PWView>
                        {searchAccessory != null ? (
                            <PWView style={styles.searchAccessory}>
                                {searchAccessory}
                            </PWView>
                        ) : null}
                    </PWView>
                )
            }
            return (
                renderItem?.({
                    ...info,
                    item: info.item,
                    index: toUserIndex(info.index),
                }) ?? null
            )
        },
        [
            renderItem,
            currentValue,
            searchPlaceholder,
            SearchInputComponent,
            showOverlay,
            handleEnterSearch,
            handleClearQuery,
            toUserIndex,
            ListHeaderComponent,
            handleHeaderLayout,
            styles.searchSticky,
            styles.searchAccessory,
            searchAccessory,
            styles.searchClearHitArea,
            styles.searchOverlayHidden,
        ],
    )

    // FlashList draws ItemSeparatorComponent between every adjacent pair, so
    // wrap the caller's to skip pairs touching a sentinel. With no caller
    // separator we draw nothing, else PWFlatList's default divider reappears.
    const augmentedSeparator = useMemo(() => {
        if (CallerSeparator == null) {
            return null
        }
        const Separator = CallerSeparator
        const WrappedSeparator = ({
            leadingItem,
            trailingItem,
        }: WrappedSeparatorProps) => {
            if (isSeparatorSuppressed(leadingItem, trailingItem)) {
                return null
            }
            return (
                <Separator
                    leadingItem={leadingItem}
                    trailingItem={trailingItem}
                />
            )
        }
        return WrappedSeparator
    }, [CallerSeparator])

    const augmentedExtraData = useMemo(
        () =>
            callerExtraData !== undefined
                ? [callerExtraData, searchValue]
                : searchValue,
        [callerExtraData, searchValue],
    )

    return {
        augmentedFooter,
        augmentedRenderItem,
        augmentedSeparator,
        augmentedExtraData,
    }
}
