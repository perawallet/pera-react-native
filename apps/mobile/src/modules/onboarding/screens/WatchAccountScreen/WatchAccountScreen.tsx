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
    PWButton,
    PWLoadingIndicator,
    PWScreen,
    PWText,
    PWView,
} from '@components/core'
import { AddressEntryField } from '@components/AddressEntryField'
import { ScreenHeader } from '@components/ScreenHeader'
import { useWatchAccountScreen } from './useWatchAccountScreen'
import { useStyles } from './styles'
import { useLanguage } from '@hooks/useLanguage'

export const WatchAccountScreen = () => {
    const styles = useStyles()
    const { t } = useLanguage()
    const {
        address,
        watchableChainIds,
        truncatedResolvedAddress,
        isValidAddress,
        isDuplicateAddress,
        isNameResolved,
        isNameResolving,
        resolvedName,
        handleAddressChange,
        handleWatchAccount,
        descriptionKey,
        invalidAddressKey,
    } = useWatchAccountScreen()

    const showInvalidError =
        address.length > 0 &&
        !isValidAddress &&
        !isNameResolving &&
        !address.includes('.')

    const errorMessageOf = () => {
        if (address.length > 0 && isDuplicateAddress) {
            return t('onboarding.watch_account.duplicate_address')
        }
        return showInvalidError ? t(invalidAddressKey) : undefined
    }
    const errorMessage = errorMessageOf()

    return (
        <PWScreen
            footer={
                <PWButton
                    testID='watch_account_submit_button'
                    variant='primary'
                    title={t('onboarding.watch_account.watch_button')}
                    onPress={handleWatchAccount}
                    isDisabled={!isValidAddress || isDuplicateAddress}
                />
            }
        >
            <ScreenHeader
                title={t('onboarding.watch_account.title')}
                description={t(descriptionKey)}
            />

            <AddressEntryField
                chainIds={watchableChainIds}
                testID='watch_account_address_input'
                placeholder={t('onboarding.watch_account.address_placeholder')}
                value={address}
                onChangeText={handleAddressChange}
                allowQRCode
                onScanned={handleAddressChange}
                errorMessage={errorMessage}
            />
            {isNameResolving && (
                <PWView style={styles.nameStatus}>
                    <PWLoadingIndicator size='sm' />
                    <PWText
                        variant='caption'
                        style={styles.nameStatusText}
                    >
                        {t('address_entry.name_resolving')}
                    </PWText>
                </PWView>
            )}
            {isNameResolved && resolvedName && (
                <PWView style={styles.nameStatus}>
                    <PWText
                        variant='caption'
                        style={styles.nameStatusText}
                    >
                        {t('address_entry.name_resolved', {
                            name: resolvedName,
                        })}
                        {' — '}
                        {truncatedResolvedAddress}
                    </PWText>
                </PWView>
            )}
        </PWScreen>
    )
}
