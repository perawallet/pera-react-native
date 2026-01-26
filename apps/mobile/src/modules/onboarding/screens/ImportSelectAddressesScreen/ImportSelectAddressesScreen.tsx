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
import { FlatList } from 'react-native'
import {
    PWView,
    PWText,
    PWToolbar,
    PWIcon,
    PWTouchableOpacity,
    PWButton,
    PWCheckbox,
    PWChip,
} from '@components/core'

import { useStyles } from './styles'
import { useImportSelectAddressesScreen } from './useImportSelectAddressesScreen'
import { useAppNavigation } from '@hooks/useAppNavigation'
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
        alreadyImportedAddresses,
        toggleSelection,
        toggleSelectAll,
        handleContinue,
        t,
    } = useImportSelectAddressesScreen()
    const navigation = useAppNavigation()

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
                    />
                )}
            </PWTouchableOpacity>
        )
    }

    return (
        <PWView style={styles.container}>
            <PWToolbar
                left={
                    <PWTouchableOpacity onPress={navigation.goBack}>
                        <PWIcon name='chevron-left' />
                    </PWTouchableOpacity>
                }
            />

            <PWView style={styles.content}>
                <PWText
                    variant='h1'
                    style={styles.title}
                >
                    {t('onboarding.import_select_addresses.title')}
                </PWText>
                <PWText
                    variant='h4'
                    style={styles.description}
                >
                    {t('onboarding.import_select_addresses.description', {
                        count: accounts.length,
                    })}
                </PWText>

                <PWView style={styles.headerRow}>
                    <PWText
                        variant='body'
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
                            {t('onboarding.import_select_addresses.select_all')}
                        </PWText>
                        <PWCheckbox
                            checked={isAllSelected}
                            onPress={toggleSelectAll}
                            containerStyle={styles.checkboxContainer}
                            uncheckedColor={
                                styles.selectAllText.color as string
                            }
                        />
                    </PWTouchableOpacity>
                </PWView>

                <FlatList
                    data={accounts}
                    renderItem={renderItem}
                    keyExtractor={item => item.address}
                    contentContainerStyle={styles.listContent}
                    showsVerticalScrollIndicator={false}
                />
            </PWView>

            <PWView style={styles.footer}>
                <PWButton
                    title={t('onboarding.import_select_addresses.continue')}
                    onPress={handleContinue}
                    variant='primary'
                    isDisabled={selectedAddresses.size === 0}
                />
            </PWView>
        </PWView>
    )
}
