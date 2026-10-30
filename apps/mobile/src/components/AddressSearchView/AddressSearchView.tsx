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

import { type ReactNode } from 'react'
import { type WalletAccount } from '@perawallet/wallet-core-accounts'
import type { ChainScope } from '@perawallet/wallet-core-chain-contract'
import { PWLoadingIndicator, PWView } from '@components/core'
import { SearchableList } from '@components/SearchableList'
import { useStyles } from './styles'
import { useAddressSearchView } from './useAddressSearchView'
import { useAddressSearchList } from './useAddressSearchList'

export type AddressSearchViewProps = {
    onSelected: (address: string, nfdName?: string) => void
    /** See {@link UseAddressSearchViewProps.scope}. */
    scope: ChainScope
    excludeAddress?: string
    /** Only accounts passing this predicate are offered. */
    accountFilter?: (account: WalletAccount) => boolean
    showAllContactsWhenEmpty?: boolean
    inBottomSheet?: boolean
    showAccountBalance?: boolean
    showAddIcon?: boolean
    /** See {@link UseAddressSearchViewProps.showClipboardPaste}. */
    showClipboardPaste?: boolean
    /** See {@link UseAddressSearchViewProps.sendingAssetLabel}. */
    sendingAssetLabel?: string
    /** See {@link UseAddressSearchViewProps.isSendingMultiChainAsset}. */
    isSendingMultiChainAsset?: boolean
}

export const AddressSearchView = ({
    onSelected,
    scope,
    excludeAddress,
    accountFilter,
    showAllContactsWhenEmpty,
    inBottomSheet,
    showAccountBalance = false,
    showAddIcon = false,
    showClipboardPaste = false,
    sendingAssetLabel,
    isSendingMultiChainAsset,
}: AddressSearchViewProps) => {
    const styles = useStyles()
    const {
        value,
        setValue,
        matchingItems,
        hasResults,
        isNfdLoading,
        wrongNetworkMessage,
        searchPlaceholder,
        chainBadgeName,
    } = useAddressSearchView({
        scope,
        excludeAddress,
        accountFilter,
        showAllContactsWhenEmpty,
        showClipboardPaste,
        sendingAssetLabel,
        isSendingMultiChainAsset,
    })

    const {
        renderItem,
        SearchInput,
        renderSeparator,
        keyExtractor,
        emptyComponent,
    } = useAddressSearchList({
        scope,
        onSelected,
        setValue,
        chainBadgeName,
        showAccountBalance,
        showAddIcon,
        wrongNetworkMessage,
    })

    // An excluded address (the send's own account) can leave nothing to list
    // before any query, which isn't a miss to report; other pickers keep it.
    let listEmptyComponent: ReactNode = null
    if (isNfdLoading) {
        listEmptyComponent = (
            <PWView style={styles.loadingContainer}>
                <PWLoadingIndicator />
            </PWView>
        )
    } else if (value.length > 0 || !excludeAddress) {
        listEmptyComponent = emptyComponent()
    }

    return (
        <PWView style={styles.container}>
            <SearchableList
                inBottomSheet={inBottomSheet}
                data={hasResults ? matchingItems : []}
                renderItem={renderItem}
                keyExtractor={keyExtractor}
                searchValue={value}
                searchPlaceholder={searchPlaceholder}
                onSearchChange={setValue}
                SearchInputComponent={SearchInput}
                ListEmptyComponent={listEmptyComponent}
                ItemSeparatorComponent={renderSeparator}
                style={styles.list}
            />
        </PWView>
    )
}
