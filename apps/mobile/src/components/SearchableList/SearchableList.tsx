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

import React, { forwardRef } from 'react'
import type { ListRenderItemInfo } from '@shopify/flash-list'

import { type PWFlatListProps, type PWFlatListRef } from '@components/core'
import { SearchableListSheet } from './SearchableListSheet'
import type { Maybe } from '@perawallet/wallet-core-shared'
import { SearchableListFull } from './SearchableListFull'

export type RenderItem<T> = (props: ListRenderItemInfo<T>) => React.ReactNode

export type SearchableListSearchProps = {
    value?: string
    placeholder?: string
    onChangeText?: (value: string) => void
    onFocus: () => void
    autoFocus?: boolean
    testID?: string
}

export type SearchableListProps<T> = Omit<
    PWFlatListProps<T>,
    'stickyHeaderIndices' | 'renderItem' | 'ListEmptyComponent'
> & {
    renderItem?: RenderItem<T>
    ListEmptyComponent?: Maybe<React.ComponentType | React.ReactElement>
    searchValue?: string
    searchPlaceholder?: string
    onSearchChange?: (value: string) => void
    SearchInputComponent?: React.ComponentType<SearchableListSearchProps>
    /**
     * Fraction of the header (`ListHeaderComponent`) revealed during a drag
     * required to snap to fully expanded; otherwise snap to fully collapsed
     * (search bar pinned). Defaults to 0.25.
     */
    snapThreshold?: number
    /** Autofocus the search input. Only honored in `inBottomSheet` mode. */
    autoFocusSearch?: boolean
    /**
     * Drawn under the search input, pinned with it, so it stays visible over an
     * empty list.
     */
    searchAccessory?: React.ReactNode
}

// Branches to the dedicated sheet path; otherwise the full-screen render with
// its collapse-on-scroll machinery. Kept hook-free so each branch is a separate
// component (rules-of-hooks safe).
const SearchableListInner = <T,>(
    props: SearchableListProps<T>,
    ref: React.ForwardedRef<PWFlatListRef>,
) => {
    if (props.inBottomSheet) {
        return (
            <SearchableListSheet
                {...props}
                ref={ref}
            />
        )
    }
    return (
        <SearchableListFull
            {...props}
            ref={ref}
        />
    )
}

export const SearchableList = forwardRef(SearchableListInner) as <T>(
    props: SearchableListProps<T> & React.RefAttributes<PWFlatListRef>,
) => React.ReactElement
