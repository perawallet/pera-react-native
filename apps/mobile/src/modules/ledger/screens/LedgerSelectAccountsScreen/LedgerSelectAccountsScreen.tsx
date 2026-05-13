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

import { SafeAreaView } from 'react-native-safe-area-context'
import {
    PWView,
    PWText,
    PWTouchableOpacity,
    PWButton,
    PWCheckbox,
    PWIcon,
    PWFlatList,
} from '@components/core'
import type { LedgerAccount } from '@perawallet/wallet-core-ledger'
import { useLanguage } from '@hooks/useLanguage'

import { useStyles } from './styles'
import { useLedgerSelectAccountsScreen } from './useLedgerSelectAccountsScreen'
import { FindAnotherWalletRow } from './FindAnotherWalletRow'
import { LedgerAccountSelectionRow } from './LedgerAccountSelectionRow'

export const LedgerSelectAccountsScreen = () => {
    const styles = useStyles()
    const { t } = useLanguage()
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
        handleOpenInfo,
    } = useLedgerSelectAccountsScreen()

    const showSelectAll = accounts.length > 1 && !areAllImported

    const renderItem = ({ item }: { item: LedgerAccount }) => {
        const isImported = alreadyImportedAddresses.has(item.address)
        const isSelected = selectedAddresses.has(item.address)
        return (
            <LedgerAccountSelectionRow
                address={item.address}
                isSelected={isSelected}
                isImported={isImported}
                onToggle={() => toggleSelection(item.address)}
                onInfoPress={() => handleOpenInfo(item.address)}
                testID={`ledger_select_row_${item.address}`}
            />
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
                <PWView style={styles.heroIcon}>
                    <PWIcon
                        name='wallet'
                        size='xl'
                    />
                </PWView>

                <PWText
                    variant='h1'
                    style={styles.title}
                >
                    {t('ledger.select_accounts.title', {
                        count: accounts.length,
                    })}
                </PWText>
                <PWText
                    variant='h4'
                    style={styles.description}
                >
                    {t('ledger.select_accounts.description')}
                </PWText>

                {showSelectAll && (
                    <PWTouchableOpacity
                        onPress={toggleSelectAll}
                        style={styles.selectAllRow}
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

            <SafeAreaView
                edges={['bottom']}
                style={styles.footer}
            >
                <PWButton
                    testID='ledger_select_accounts_continue_button'
                    title={t('ledger.select_accounts.cta', {
                        count: selectedAddresses.size,
                    })}
                    onPress={handleContinue}
                    variant='primary'
                    isDisabled={!canContinue}
                />
            </SafeAreaView>
        </PWView>
    )
}
