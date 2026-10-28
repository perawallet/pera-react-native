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

import { useCallback, useMemo } from 'react'
import { addressOn, type WalletAccount } from '@perawallet/wallet-core-accounts'
import type {
    ChainScope,
    I18nKey,
} from '@perawallet/wallet-core-chain-contract'
import { getChainDescriptor } from '@perawallet/wallet-core-chain-shared'
import {
    PWIcon,
    PWLoadingIndicator,
    PWText,
    PWTouchableOpacity,
    PWView,
} from '@components/core'
import { EmptyView } from '@components/EmptyView'
import { AddressDisplay } from '@components/AddressDisplay'
import {
    SearchableList,
    type SearchableListSearchProps,
} from '@components/SearchableList'
import { useLanguage } from '@hooks/useLanguage'
import { chainUiFor } from '@modules/chain-ui'
import { AccountResultRow } from './AccountResultRow'
import { AddressSearchInput } from './AddressSearchInput'
import { PasteFromClipboardRow } from './PasteFromClipboardRow'
import { useStyles } from './styles'
import {
    useAddressSearchView,
    type AddressSearchItem,
} from './useAddressSearchView'

/** A family's copy for an address entered where another family's is expected. */
export type WrongNetworkAddressCopy = {
    /** Names this family, for its address entered elsewhere. */
    titleKey: I18nKey
    /** For a field that takes this family's addresses. */
    bodyKey: I18nKey
    /** As `bodyKey`, while sending the `{{asset}}` on the `{{network}}` chain. */
    sendBodyKey: I18nKey
}

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
    /**
     * The asset being sent, such as its unit name. Set, the wrong-network
     * message speaks of sending it; unset, it stays neutral.
     */
    sendingAssetLabel?: string
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
}: AddressSearchViewProps) => {
    const styles = useStyles()
    const { t } = useLanguage()
    const {
        value,
        setValue,
        matchingItems,
        hasResults,
        isNfdLoading,
        mismatchedFamily,
    } = useAddressSearchView({
        scope,
        excludeAddress,
        accountFilter,
        showAllContactsWhenEmpty,
        showClipboardPaste,
    })

    const renderItem = useCallback(
        ({ item }: { item: AddressSearchItem }) => {
            switch (item.type) {
                case 'section_header': {
                    return <PWText variant='h4'>{t(item.title)}</PWText>
                }
                case 'paste': {
                    // Fills the field instead of selecting outright, matching
                    // native: the user still confirms the pasted address.
                    return (
                        <PasteFromClipboardRow
                            address={item.address}
                            onPress={setValue}
                        />
                    )
                }
                case 'contact': {
                    return (
                        <PWTouchableOpacity
                            onPress={() => onSelected(item.address)}
                        >
                            <AddressDisplay
                                scope={scope}
                                address={item.address}
                                showCopy={false}
                                style={styles.accountDisplay}
                            />
                        </PWTouchableOpacity>
                    )
                }
                case 'account': {
                    const address = addressOn(item.account, scope) ?? ''
                    return (
                        <PWTouchableOpacity
                            onPress={() => onSelected(address)}
                            testID={`account_result_row_${address}`}
                        >
                            <AccountResultRow
                                account={item.account}
                                showBalance={showAccountBalance}
                                chainId={scope.chainId}
                            />
                        </PWTouchableOpacity>
                    )
                }
                case 'address': {
                    return (
                        <PWTouchableOpacity
                            onPress={() => onSelected(item.address)}
                            style={showAddIcon ? styles.foreignRow : undefined}
                        >
                            <AddressDisplay
                                scope={scope}
                                address={item.address}
                                showCopy={false}
                                forceShowIcon
                                style={
                                    showAddIcon
                                        ? styles.accountDisplayInRow
                                        : styles.accountDisplay
                                }
                            />
                            {showAddIcon && (
                                <PWView
                                    style={styles.addIconButton}
                                    testID='address-search-add-icon'
                                >
                                    <PWIcon
                                        name='plus'
                                        variant='helper'
                                        size='sm'
                                    />
                                </PWView>
                            )}
                        </PWTouchableOpacity>
                    )
                }
                case 'nfd': {
                    return (
                        <PWTouchableOpacity
                            onPress={() =>
                                onSelected(item.nfd.address, item.nfd.name)
                            }
                            style={
                                showAddIcon ? styles.foreignRow : styles.nfdItem
                            }
                        >
                            <AddressDisplay
                                scope={scope}
                                address={item.nfd.address}
                                showCopy={false}
                                style={
                                    showAddIcon
                                        ? styles.accountDisplayInRow
                                        : styles.accountDisplay
                                }
                            />
                            {showAddIcon && (
                                <PWView
                                    style={styles.addIconButton}
                                    testID='address-search-add-icon'
                                >
                                    <PWIcon
                                        name='plus'
                                        variant='helper'
                                        size='sm'
                                    />
                                </PWView>
                            )}
                        </PWTouchableOpacity>
                    )
                }
            }
        },
        [
            onSelected,
            setValue,
            styles,
            t,
            showAccountBalance,
            showAddIcon,
            scope,
        ],
    )

    // SearchableList takes a component, so the scanned chain is bound here.
    const SearchInput = useMemo(() => {
        const chainIds = [scope.chainId]
        const BoundAddressSearchInput = (props: SearchableListSearchProps) => (
            <AddressSearchInput
                {...props}
                chainIds={chainIds}
            />
        )
        return BoundAddressSearchInput
    }, [scope.chainId])

    const renderSeparator = useCallback(
        () => <PWView style={styles.listSeparator} />,
        [styles],
    )

    const keyExtractor = useCallback((item: AddressSearchItem) => item.key, [])

    const emptyComponent = useCallback(() => {
        const addressCopy =
            mismatchedFamily && chainUiFor(mismatchedFamily).wrongNetworkAddress
        const descriptor = getChainDescriptor(scope.chainId)
        const expectedCopy = chainUiFor(descriptor.family).wrongNetworkAddress
        if (addressCopy && expectedCopy) {
            return (
                <EmptyView
                    title={t(addressCopy.titleKey)}
                    body={
                        sendingAssetLabel
                            ? t(expectedCopy.sendBodyKey, {
                                  asset: sendingAssetLabel,
                                  network: descriptor.displayName,
                              })
                            : t(expectedCopy.bodyKey)
                    }
                />
            )
        }
        return (
            <EmptyView
                title={t('address_entry.no_accounts_found')}
                body={t('address_entry.no_accounts_body')}
            />
        )
    }, [t, mismatchedFamily, scope.chainId, sendingAssetLabel])

    const listEmptyComponent = isNfdLoading ? (
        <PWView style={styles.loadingContainer}>
            <PWLoadingIndicator />
        </PWView>
    ) : (
        emptyComponent()
    )

    return (
        <PWView style={styles.container}>
            <SearchableList
                inBottomSheet={inBottomSheet}
                data={hasResults ? matchingItems : []}
                renderItem={renderItem}
                keyExtractor={keyExtractor}
                searchValue={value}
                searchPlaceholder={t('address_entry.search_placeholder')}
                onSearchChange={setValue}
                SearchInputComponent={SearchInput}
                ListEmptyComponent={listEmptyComponent}
                ItemSeparatorComponent={renderSeparator}
                style={styles.list}
            />
        </PWView>
    )
}
