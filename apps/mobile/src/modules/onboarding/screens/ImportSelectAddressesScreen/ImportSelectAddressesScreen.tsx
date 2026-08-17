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

import React from 'react'
import {
    PWView,
    PWText,
    PWTouchableOpacity,
    PWButton,
    PWCheckbox,
    PWFlatList,
    PWLoadingOverlay,
    PWScreen,
} from '@components/core'
import { EmptyView } from '@components/EmptyView'
import { ScreenHeader } from '@components/ScreenHeader'
import { SelectableAccountCheckboxRow } from '@modules/accounts/components/SelectableAccountCheckboxRow'

import { useStyles } from './styles'
import { useImportSelectAddressesScreen } from './useImportSelectAddressesScreen'
import {
    getAccountDisplayName,
    type HDWalletAccount,
} from '@perawallet/wallet-core-accounts'

export const ImportSelectAddressesScreen = () => {
    const styles = useStyles()
    const {
        accounts,
        selectedAddresses,
        isAllSelected,
        areAllImported,
        canContinue,
        isProcessing,
        alreadyImportedAddresses,
        toggleSelection,
        toggleSelectAll,
        handleContinue,
        t,
    } = useImportSelectAddressesScreen()

    const renderItem = ({ item }: { item: HDWalletAccount }) => {
        const isImported = alreadyImportedAddresses.has(item.address)
        const isSelected = selectedAddresses.has(item.address)

        return (
            <SelectableAccountCheckboxRow
                title={getAccountDisplayName(item)}
                isSelected={isSelected}
                isImported={isImported}
                importedLabel={t(
                    'onboarding.import_select_addresses.already_imported',
                )}
                onToggle={() => toggleSelection(item.address)}
                checkboxTestID={`import_select_addresses_item_checkbox_${item.address}`}
            />
        )
    }

    return (
        <>
            <PWScreen
                scroll='never'
                footer={
                    <PWButton
                        testID='import_select_addresses_continue_button'
                        title={t(
                            'onboarding.import_select_addresses.finish_button',
                        )}
                        onPress={handleContinue}
                        variant='primary'
                        isDisabled={!canContinue}
                    />
                }
            >
                <PWView style={styles.content}>
                    <ScreenHeader
                        title={t('onboarding.import_select_addresses.title')}
                        description={
                            !areAllImported
                                ? t(
                                      'onboarding.import_select_addresses.description',
                                      {
                                          count: accounts.length,
                                      },
                                  )
                                : undefined
                        }
                    />

                    {areAllImported ? (
                        // Distinct from `searching_accounts.no_new_addresses`,
                        // which says nothing was FOUND. Reaching this screen
                        // means discovery did return addresses (see
                        // `useSearchAccountsScreen`, which throws on an empty
                        // result) — they were all filtered out because they are
                        // already in the accounts store. `useAllAccounts` is
                        // unfiltered, so a watch account for the same address
                        // lands here too, which is not obvious to the user.
                        <EmptyView
                            style={styles.emptyState}
                            title={t(
                                'onboarding.import_select_addresses.all_imported_title',
                            )}
                            body={t(
                                'onboarding.import_select_addresses.all_imported_body',
                            )}
                        />
                    ) : (
                        <>
                            <PWView style={styles.headerRow}>
                                <PWText
                                    variant='bodySemibold'
                                    style={styles.headerCount}
                                >
                                    {t(
                                        'onboarding.import_select_addresses.addresses_count',
                                        {
                                            count: accounts.length,
                                        },
                                    )}
                                </PWText>

                                <PWTouchableOpacity
                                    onPress={toggleSelectAll}
                                    style={styles.selectAllContainer}
                                >
                                    <PWText
                                        variant='link'
                                        style={styles.selectAllText}
                                    >
                                        {t(
                                            'onboarding.import_select_addresses.select_all',
                                        )}
                                    </PWText>
                                    <PWCheckbox
                                        checked={isAllSelected}
                                        onPress={toggleSelectAll}
                                        testID='import_select_addresses_select_all_checkbox'
                                    />
                                </PWTouchableOpacity>
                            </PWView>

                            <PWFlatList
                                data={accounts}
                                renderItem={renderItem}
                                keyExtractor={item => item.address}
                                extraData={selectedAddresses}
                                cardLayout
                                showsVerticalScrollIndicator={false}
                            />
                        </>
                    )}
                </PWView>
            </PWScreen>

            <PWLoadingOverlay
                isVisible={isProcessing}
                title={t('onboarding.import_rekeyed_addresses.fetching')}
            />
        </>
    )
}
