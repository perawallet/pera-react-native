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
import { truncateAlgorandAddress } from '@perawallet/wallet-core-shared'
import {
    PWButton,
    PWCheckbox,
    PWFlatList,
    PWLoadingOverlay,
    PWScreen,
    PWText,
    PWTouchableOpacity,
    PWView,
} from '@components/core'
import { ScreenHeader } from '@components/ScreenHeader'
import { SelectableAccountCheckboxRow } from '@modules/accounts/components/SelectableAccountCheckboxRow'
import { useLanguage } from '@hooks/useLanguage'
import { useStyles } from './styles'
import {
    useAsbImportSelectAccountsScreen,
    type AsbAccountListItem,
} from './useAsbImportSelectAccountsScreen'

export const AsbImportSelectAccountsScreen = () => {
    const styles = useStyles()
    const { t } = useLanguage()
    const {
        items,
        selectedAddresses,
        canContinue,
        isProcessing,
        isAllSelected,
        areAllImported,
        importableCount,
        toggleSelection,
        toggleSelectAll,
        handleContinue,
    } = useAsbImportSelectAccountsScreen()

    const renderItem = ({ item }: { item: AsbAccountListItem }) => {
        const isSelected = selectedAddresses.has(item.address)
        const isImported = item.isAlreadyImported
        const displayName =
            item.name?.trim() || truncateAlgorandAddress(item.address)

        return (
            <SelectableAccountCheckboxRow
                title={displayName}
                subtitle={truncateAlgorandAddress(item.address)}
                isSelected={isSelected}
                isImported={isImported}
                importedLabel={t(
                    'onboarding.asb_import.select.already_imported',
                )}
                onToggle={() => toggleSelection(item.address)}
                checkboxTestID={`asb_import_select_item_${item.address}`}
            />
        )
    }

    return (
        <>
            <PWScreen
                scroll={false}
                footer={
                    <PWButton
                        variant='primary'
                        title={t('onboarding.asb_import.select.continue')}
                        onPress={handleContinue}
                        isDisabled={!canContinue}
                        testID='asb_import_select_continue_button'
                    />
                }
            >
                <PWView style={styles.content}>
                    <ScreenHeader
                        title={t('onboarding.asb_import.select.title')}
                        description={t('onboarding.asb_import.select.body', {
                            count: items.length,
                        })}
                    />

                    {!areAllImported && (
                        <PWView style={styles.headerRow}>
                            <PWText
                                variant='bodySemibold'
                                style={styles.headerCount}
                            >
                                {t('onboarding.asb_import.select.count', {
                                    count: importableCount,
                                })}
                            </PWText>
                            <PWTouchableOpacity
                                onPress={toggleSelectAll}
                                style={styles.selectAll}
                                testID='asb_import_select_select_all'
                            >
                                <PWText
                                    variant='link'
                                    style={styles.selectAllText}
                                >
                                    {t(
                                        'onboarding.asb_import.select.select_all',
                                    )}
                                </PWText>
                                <PWCheckbox
                                    checked={isAllSelected}
                                    onPress={toggleSelectAll}
                                />
                            </PWTouchableOpacity>
                        </PWView>
                    )}

                    <PWFlatList
                        data={items}
                        renderItem={renderItem}
                        keyExtractor={item => item.address}
                        extraData={selectedAddresses}
                        showsVerticalScrollIndicator={false}
                    />
                </PWView>
            </PWScreen>

            <PWLoadingOverlay
                isVisible={isProcessing}
                title={t('onboarding.asb_import.select.importing')}
            />
        </>
    )
}
