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

import { useCallback } from 'react'
import { ActivityIndicator } from 'react-native'
import type { AccountType } from '@perawallet/wallet-core-accounts'
import {
    PWFlatList,
    PWIcon,
    PWText,
    PWTouchableOpacity,
    PWView,
} from '@components/core'
import { AddressEntryField } from '@components/AddressEntryField'
import { EmptyView } from '@components/EmptyView'
import { AddressDisplay } from '@components/AddressDisplay'
import { useLanguage } from '@hooks/useLanguage'
import { AccountResultRow } from './AccountResultRow'
import { useStyles } from './styles'
import {
    useAddressSearchView,
    type AddressSearchItem,
} from './useAddressSearchView'

export type AddressSearchViewProps = {
    onSelected: (address: string) => void
    excludeAddress?: string
    excludeTypes?: AccountType[]
    showAllContactsWhenEmpty?: boolean
    inBottomSheet?: boolean
    showAccountBalance?: boolean
    showAddIcon?: boolean
}

export const AddressSearchView = ({
    onSelected,
    excludeAddress,
    excludeTypes,
    showAllContactsWhenEmpty,
    inBottomSheet,
    showAccountBalance = false,
    showAddIcon = false,
}: AddressSearchViewProps) => {
    const styles = useStyles()
    const { t } = useLanguage()
    const { value, setValue, matchingItems, hasResults, isNfdLoading } =
        useAddressSearchView({
            excludeAddress,
            excludeTypes,
            showAllContactsWhenEmpty,
        })

    const renderItem = useCallback(
        ({ item }: { item: AddressSearchItem }) => {
            switch (item.type) {
                case 'section_header':
                    return (
                        <PWView style={styles.sectionHeader}>
                            <PWText
                                variant='h4'
                                style={styles.title}
                            >
                                {t(item.title)}
                            </PWText>
                        </PWView>
                    )
                case 'contact':
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
                case 'account':
                    return (
                        <PWTouchableOpacity
                            onPress={() => onSelected(item.account.address)}
                        >
                            <AccountResultRow
                                account={item.account}
                                showBalance={showAccountBalance}
                            />
                        </PWTouchableOpacity>
                    )
                case 'address':
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
                case 'nfd':
                    return (
                        <PWTouchableOpacity
                            onPress={() => onSelected(item.nfd.address)}
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
        },
        [onSelected, styles, t, showAccountBalance, showAddIcon],
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

    return (
        <PWView style={styles.container}>
            <AddressEntryField
                onChangeText={setValue}
                value={value}
                allowQRCode
                onScanned={setValue}
                placeholder={t('address_entry.search_placeholder')}
                inputContainerStyle={styles.searchField}
                leftIcon={
                    <PWIcon
                        variant='secondary'
                        name='magnifying-glass'
                    />
                }
            />
            <PWFlatList
                data={hasResults ? matchingItems : []}
                renderItem={renderItem}
                keyExtractor={keyExtractor}
                ListEmptyComponent={
                    isNfdLoading ? (
                        <PWView style={styles.loadingContainer}>
                            <ActivityIndicator />
                        </PWView>
                    ) : (
                        emptyComponent()
                    )
                }
                inBottomSheet={inBottomSheet}
                style={styles.list}
                contentContainerStyle={styles.contentContainer}
            />
        </PWView>
    )
}
