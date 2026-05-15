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
    PWLoadingOverlay,
} from '@components/core'
import { SafeAreaView } from 'react-native-safe-area-context'
import { EmptyView } from '@components/EmptyView'

import { useStyles } from './styles'
import { useImportSelectAddressesScreen } from './useImportSelectAddressesScreen'
import {
    getAccountDisplayName,
    HDWalletAccount,
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
        const displayName = getAccountDisplayName(item)

        return (
            <PWTouchableOpacity
                style={styles.itemContainer}
                onPress={() => toggleSelection(item.address)}
                disabled={isImported}
            >
                <PWView style={styles.itemTextContainer}>
                    <PWText
                        variant='body'
                        style={styles.itemTitle}
                    >
                        {displayName}
                    </PWText>
                </PWView>

                {isImported ? (
                    <PWChip
                        title={t(
                            'onboarding.import_select_addresses.already_imported',
                        )}
                        variant='secondary'
                    />
                ) : (
                    <PWCheckbox
                        checked={isSelected}
                        onPress={() => toggleSelection(item.address)}
                        containerStyle={styles.checkboxContainer}
                        testID={`import_select_addresses_item_checkbox_${item.address}`}
                    />
                )}
            </PWTouchableOpacity>
        )
    }

    return (
        <PWView style={styles.container}>
            <PWView style={styles.content}>
                <PWText
                    variant='h1'
                    style={styles.title}
                >
                    {t('onboarding.import_select_addresses.title')}
                </PWText>
                {!areAllImported && (
                    <PWText
                        variant='h4'
                        style={styles.description}
                    >
                        {t('onboarding.import_select_addresses.description', {
                            count: accounts.length,
                        })}
                    </PWText>
                )}

                {areAllImported ? (
                    <EmptyView
                        style={styles.emptyState}
                        title={t(
                            'onboarding.searching_accounts.no_new_addresses_title',
                        )}
                        body={t(
                            'onboarding.searching_accounts.no_new_addresses_body',
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
                                    containerStyle={styles.checkboxContainer}
                                    testID='import_select_addresses_select_all_checkbox'
                                />
                            </PWTouchableOpacity>
                        </PWView>

                        <PWFlatList
                            data={accounts}
                            renderItem={renderItem}
                            keyExtractor={item => item.address}
                            extraData={selectedAddresses}
                            contentContainerStyle={styles.listContent}
                            showsVerticalScrollIndicator={false}
                        />
                    </>
                )}
            </PWView>

            <SafeAreaView
                edges={['bottom']}
                style={styles.footer}
            >
                <PWButton
                    testID='import_select_addresses_continue_button'
                    title={t(
                        'onboarding.import_select_addresses.finish_button',
                    )}
                    onPress={handleContinue}
                    variant='primary'
                    isDisabled={!canContinue}
                />
            </SafeAreaView>

            <PWLoadingOverlay
                isVisible={isProcessing}
                title={t('onboarding.import_rekeyed_addresses.fetching')}
            />
        </PWView>
    )
}
