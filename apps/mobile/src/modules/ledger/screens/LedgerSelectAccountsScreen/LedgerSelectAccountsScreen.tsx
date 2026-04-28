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

import React from 'react'
import {
    PWView,
    PWText,
    PWTouchableOpacity,
    PWButton,
    PWCheckbox,
    PWChip,
    PWFlatList,
} from '@components/core'
import type { LedgerAccount } from '@perawallet/wallet-core-ledger'

import { truncateAlgorandAddress } from '@perawallet/wallet-core-shared'
import { useStyles } from './styles'
import { useLedgerSelectAccountsScreen } from './useLedgerSelectAccountsScreen'
import { FindAnotherWalletRow } from './FindAnotherWalletRow'

export const LedgerSelectAccountsScreen = () => {
    const styles = useStyles()
    const {
        accounts,
        selectedAddresses,
        isAllSelected,
        areAllImported,
        canContinue,
        alreadyImportedAddresses,
        isFetchingMore,
        toggleSelection,
        toggleSelectAll,
        handleContinue,
        handleFindAnother,
        t,
    } = useLedgerSelectAccountsScreen()

    const renderItem = ({ item }: { item: LedgerAccount }) => {
        const isImported = alreadyImportedAddresses.has(item.address)
        const isSelected = selectedAddresses.has(item.address)

        return (
            <PWTouchableOpacity
                style={[
                    styles.itemContainer,
                    isSelected && styles.selectedItem,
                ]}
                onPress={() => toggleSelection(item.address)}
                disabled={isImported}
            >
                <PWView style={styles.itemTextContainer}>
                    <PWText
                        variant='body'
                        style={styles.itemTitle}
                    >
                        {t('ledger.select_accounts.account_label', {
                            index: item.accountIndex + 1,
                        })}
                    </PWText>
                    <PWText
                        variant='caption'
                        style={styles.itemSubtitle}
                    >
                        {truncateAlgorandAddress(item.address, 13)}
                    </PWText>
                </PWView>

                {isImported ? (
                    <PWChip
                        title={t('ledger.select_accounts.already_imported')}
                        variant='secondary'
                    />
                ) : (
                    <PWCheckbox
                        checked={isSelected}
                        onPress={() => toggleSelection(item.address)}
                        containerStyle={styles.checkboxContainer}
                        testID={`ledger_select_accounts_checkbox_${item.address}`}
                    />
                )}
            </PWTouchableOpacity>
        )
    }

    const renderFooter = () => (
        <FindAnotherWalletRow
            onPress={handleFindAnother}
            isLoading={isFetchingMore}
            label={t('ledger.select_accounts.find_another_wallet')}
            testID='ledger_select_accounts_find_another'
        />
    )

    return (
        <PWView style={styles.container}>
            <PWView style={styles.content}>
                <PWText
                    variant='h1'
                    style={styles.title}
                >
                    {t('ledger.select_accounts.title')}
                </PWText>
                <PWText
                    variant='h4'
                    style={styles.description}
                >
                    {t('ledger.select_accounts.description', {
                        count: accounts.length,
                    })}
                </PWText>

                <PWView style={styles.headerRow}>
                    <PWText
                        variant='bodySemibold'
                        style={styles.headerCount}
                    >
                        {t('ledger.select_accounts.accounts_count', {
                            count: accounts.length,
                        })}
                    </PWText>

                    {!areAllImported && (
                        <PWTouchableOpacity
                            onPress={toggleSelectAll}
                            style={styles.selectAllContainer}
                        >
                            <PWText
                                variant='link'
                                style={styles.selectAllText}
                            >
                                {t('ledger.select_accounts.select_all')}
                            </PWText>
                            <PWCheckbox
                                checked={isAllSelected}
                                onPress={toggleSelectAll}
                                containerStyle={styles.checkboxContainer}
                                testID='ledger_select_accounts_select_all_checkbox'
                            />
                        </PWTouchableOpacity>
                    )}
                </PWView>

                <PWFlatList
                    data={accounts}
                    renderItem={renderItem}
                    keyExtractor={item => item.address}
                    extraData={selectedAddresses}
                    contentContainerStyle={styles.listContent}
                    showsVerticalScrollIndicator={false}
                    ListFooterComponent={renderFooter}
                />
            </PWView>

            <PWView style={styles.footer}>
                <PWButton
                    testID='ledger_select_accounts_continue_button'
                    title={t('ledger.select_accounts.continue')}
                    onPress={handleContinue}
                    variant='primary'
                    isDisabled={!canContinue}
                />
            </PWView>
        </PWView>
    )
}
