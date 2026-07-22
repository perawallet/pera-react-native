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
    PWScreen,
    PWText,
    PWTouchableOpacity,
    PWButton,
    PWCheckbox,
    PWFlatList,
} from '@components/core'
import { ListItemDivider } from '@components/ListItemDivider'
import { ScreenHeader } from '@components/ScreenHeader'
import type { LedgerSelectableAccount } from '@perawallet/wallet-core-accounts'
import { useLanguage } from '@hooks/useLanguage'

import { useStyles } from './styles'
import { useLedgerSelectAccountsScreen } from './useLedgerSelectAccountsScreen'
import { FindAnotherAccountRow } from './FindAnotherAccountRow'
import { LedgerAccountSelectionRow } from './LedgerAccountSelectionRow'

export const LedgerSelectAccountsScreen = () => {
    const styles = useStyles()
    const { t } = useLanguage()
    const {
        selectableAccounts,
        isScanning,
        selectedAddresses,
        isAllSelected,
        areAllImported,
        canContinue,
        alreadyImportedAddresses,
        upgradeableAddresses,
        isFetchingMore,
        toggleSelection,
        toggleSelectAll,
        handleContinue,
        handleFindAnother,
        handleInfoPress,
    } = useLedgerSelectAccountsScreen()

    const showSelectAll = selectableAccounts.length > 1 && !areAllImported

    const renderItem = ({ item }: { item: LedgerSelectableAccount }) => {
        const address =
            item.kind === 'derived' ? item.account.address : item.address
        const accountIndex =
            item.kind === 'derived'
                ? item.account.accountIndex
                : item.authAccount.accountIndex
        const isImported = alreadyImportedAddresses.has(address)
        const isSelected = selectedAddresses.has(address)
        return (
            <LedgerAccountSelectionRow
                address={address}
                accountIndex={accountIndex}
                variant={item.kind}
                isSelected={isSelected}
                isImported={isImported}
                isUpgradeable={upgradeableAddresses.has(address)}
                onToggle={() => toggleSelection(address)}
                onInfoPress={handleInfoPress}
                testID={`ledger_select_row_${address}`}
            />
        )
    }

    const renderFooter = () => (
        <>
            {isScanning && (
                <PWText
                    variant='caption'
                    style={styles.description}
                    testID='ledger_select_accounts_scanning'
                >
                    {t('ledger.select_accounts.scanning_rekeyed')}
                </PWText>
            )}
            <FindAnotherAccountRow
                onPress={() => void handleFindAnother()}
                isLoading={isFetchingMore}
                label={t('ledger.select_accounts.find_another_account')}
                testID='ledger_select_accounts_find_another'
            />
        </>
    )

    return (
        <PWScreen
            scroll='never'
            footer={
                <PWButton
                    testID='ledger_select_accounts_continue_button'
                    title={
                        areAllImported
                            ? t('ledger.select_accounts.cta_done')
                            : t('ledger.select_accounts.cta', {
                                  count: selectedAddresses.size,
                              })
                    }
                    onPress={handleContinue}
                    variant='primary'
                    isDisabled={!canContinue}
                />
            }
        >
            <ScreenHeader
                icon='wallet'
                title={t('ledger.select_accounts.title', {
                    count: selectableAccounts.length,
                })}
                description={t('ledger.select_accounts.description')}
            />

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
                data={selectableAccounts}
                renderItem={renderItem}
                keyExtractor={item =>
                    item.kind === 'derived'
                        ? item.account.address
                        : item.address
                }
                extraData={selectedAddresses}
                showsVerticalScrollIndicator={false}
                ItemSeparatorComponent={ListItemDivider}
                ListFooterComponent={renderFooter}
            />
        </PWScreen>
    )
}
