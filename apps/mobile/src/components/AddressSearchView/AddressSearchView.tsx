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

import { useCallback } from 'react'
import { ActivityIndicator } from 'react-native'
import type { AccountType } from '@perawallet/wallet-core-accounts'
import { PWIcon, PWText, PWTouchableOpacity, PWView } from '@components/core'
import { EmptyView } from '@components/EmptyView'
import { AddressDisplay } from '@components/AddressDisplay'
import { SearchableList } from '@components/SearchableList'
import { useLanguage } from '@hooks/useLanguage'
import { AccountResultRow } from './AccountResultRow'
import { AddressSearchInput } from './AddressSearchInput'
import { PasteFromClipboardRow } from './PasteFromClipboardRow'
import { useStyles } from './styles'
import {
    useAddressSearchView,
    type AddressSearchItem,
} from './useAddressSearchView'

export type AddressSearchViewProps = {
    onSelected: (address: string, nfdName?: string) => void
    excludeAddress?: string
    excludeTypes?: AccountType[]
    showAllContactsWhenEmpty?: boolean
    inBottomSheet?: boolean
    showAccountBalance?: boolean
    showAddIcon?: boolean
    /** See {@link UseAddressSearchViewProps.showClipboardPaste}. */
    showClipboardPaste?: boolean
}

export const AddressSearchView = ({
    onSelected,
    excludeAddress,
    excludeTypes,
    showAllContactsWhenEmpty,
    inBottomSheet,
    showAccountBalance = false,
    showAddIcon = false,
    showClipboardPaste = false,
}: AddressSearchViewProps) => {
    const styles = useStyles()
    const { t } = useLanguage()
    const { value, setValue, matchingItems, hasResults, isNfdLoading } =
        useAddressSearchView({
            excludeAddress,
            excludeTypes,
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
                            onPress={() => onSelected(item.contact.address)}
                        >
                            <AddressDisplay
                                address={item.contact.address}
                                showCopy={false}
                                style={styles.accountDisplay}
                            />
                        </PWTouchableOpacity>
                    )
                }
                case 'account': {
                    return (
                        <PWTouchableOpacity
                            onPress={() => onSelected(item.account.address)}
                            testID={`account_result_row_${item.account.address}`}
                        >
                            <AccountResultRow
                                account={item.account}
                                showBalance={showAccountBalance}
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
        [onSelected, setValue, styles, t, showAccountBalance, showAddIcon],
    )

    const renderSeparator = useCallback(
        () => <PWView style={styles.listSeparator} />,
        [styles],
    )

    const keyExtractor = useCallback((item: AddressSearchItem) => item.key, [])

    const emptyComponent = useCallback(
        () => (
            <EmptyView
                title={t('address_entry.no_accounts_found')}
                body={t('address_entry.no_accounts_body')}
            />
        ),
        [t],
    )

    const listEmptyComponent = isNfdLoading ? (
        <PWView style={styles.loadingContainer}>
            <ActivityIndicator />
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
                SearchInputComponent={AddressSearchInput}
                ListEmptyComponent={listEmptyComponent}
                ItemSeparatorComponent={renderSeparator}
                style={styles.list}
            />
        </PWView>
    )
}
