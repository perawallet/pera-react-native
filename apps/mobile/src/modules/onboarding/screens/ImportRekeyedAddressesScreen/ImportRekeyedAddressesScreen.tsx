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
    PWToolbar,
    PWIcon,
    PWTouchableOpacity,
    PWButton,
    PWCheckbox,
    PWChip,
    PWFlatList,
    PWRoundIcon,
} from '@components/core'

import { useStyles } from './styles'
import { useImportRekeyedAddressesScreen } from './useImportRekeyedAddressesScreen'
import { useAppNavigation } from '@hooks/useAppNavigation'
import { Algo25Account } from '@perawallet/wallet-core-accounts'

export const ImportRekeyedAddressesScreen = () => {
    const styles = useStyles()
    const {
        accounts,
        selectedAddresses,
        canContinue,
        alreadyImportedAddresses,
        toggleSelection,
        handleContinue,
        handleSkip,
        t,
    } = useImportRekeyedAddressesScreen()
    const navigation = useAppNavigation()

    const renderItem = ({ item }: { item: Algo25Account }) => {
        const isImported = alreadyImportedAddresses.has(item.address)
        const isSelected = selectedAddresses.has(item.address)

        return (
            <PWTouchableOpacity
                style={styles.itemContainer}
                onPress={() => toggleSelection(item.address)}
                disabled={isImported}
            >
                {!isImported && (
                    <PWView style={styles.checkboxWrapper}>
                        <PWCheckbox
                            checked={isSelected}
                            onPress={() => toggleSelection(item.address)}
                            containerStyle={styles.checkboxContainer}
                        />
                    </PWView>
                )}

                <PWView style={styles.itemContent}>
                    <PWView style={styles.iconContainer}>
                        <PWRoundIcon
                            icon='rekey'
                            variant='helper'
                            size='md'
                        />
                    </PWView>

                    <PWView style={styles.itemTextContainer}>
                        <PWText
                            variant='body'
                            style={styles.itemTitle}
                            numberOfLines={1}
                            ellipsizeMode='middle'
                        >
                            {item.address}
                        </PWText>
                        <PWText
                            variant='caption'
                            style={styles.itemSubtitle}
                        >
                            {t(
                                'onboarding.import_rekeyed_addresses.rekeyed_account_subtitle',
                            )}
                        </PWText>
                    </PWView>

                    <PWView style={styles.infoIconContainer}>
                        <PWIcon
                            name='info'
                            size='md'
                            variant='secondary'
                        />
                    </PWView>
                </PWView>

                {isImported && (
                    <PWChip
                        title={t(
                            'onboarding.import_rekeyed_addresses.already_imported',
                        )}
                        variant='secondary'
                    />
                )}
            </PWTouchableOpacity>
        )
    }

    const renderHeader = () => (
        <PWView style={styles.headerContainer}>
            <PWView style={styles.headerIconContainer}>
                <PWIcon
                    name='wallet'
                    size='lg'
                />
            </PWView>
            <PWText
                variant='h3'
                style={styles.title}
            >
                {t('onboarding.import_rekeyed_addresses.title', {
                    count: accounts.length,
                })}
            </PWText>
            <PWText
                variant='h4'
                style={styles.description}
            >
                {t('onboarding.import_rekeyed_addresses.description_line_1', {
                    count: accounts.length,
                })}
            </PWText>
            <PWText
                variant='h4'
                style={styles.description}
            >
                {t('onboarding.import_rekeyed_addresses.description_line_2')}
            </PWText>
        </PWView>
    )

    const renderFooter = () => (
        <PWView style={styles.footer}>
            <PWButton
                title={t('onboarding.import_rekeyed_addresses.continue')}
                onPress={handleContinue}
                variant={canContinue ? 'primary' : 'secondary'}
                isDisabled={!canContinue}
                style={styles.continueButton}
            />

            <PWButton
                title={t('onboarding.import_rekeyed_addresses.skip')}
                onPress={handleSkip}
                variant='secondary'
            />
        </PWView>
    )

    return (
        <PWView style={styles.container}>
            <PWToolbar
                left={
                    <PWTouchableOpacity onPress={navigation.goBack}>
                        <PWIcon name='chevron-left' />
                    </PWTouchableOpacity>
                }
            />

            <PWFlatList
                data={accounts}
                renderItem={renderItem}
                keyExtractor={item => item.address}
                contentContainerStyle={styles.listContent}
                showsVerticalScrollIndicator={false}
                ListHeaderComponent={renderHeader}
                style={styles.list}
            />
            {renderFooter()}
        </PWView>
    )
}
