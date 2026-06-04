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
import { ActivityIndicator } from 'react-native'
import { PWButton, PWScreen, PWText, PWView } from '@components/core'
import { AddressEntryField } from '@components/AddressEntryField'
import { ScreenHeader } from '@components/ScreenHeader'
import { useWatchAccountScreen } from './useWatchAccountScreen'
import { useStyles } from './styles'
import { useLanguage } from '@hooks/useLanguage'
import { truncateAlgorandAddress } from '@perawallet/wallet-core-shared'

export const WatchAccountScreen = () => {
    const styles = useStyles()
    const { t } = useLanguage()
    const {
        address,
        resolvedAddress,
        isValidAddress,
        isDuplicateAddress,
        isNfdResolved,
        isNfdResolving,
        nfdName,
        handleAddressChange,
        handleWatchAccount,
    } = useWatchAccountScreen()

    const showInvalidError =
        address.length > 0 &&
        !isValidAddress &&
        !isNfdResolving &&
        !address.includes('.')

    const errorMessage =
        address.length > 0 && isDuplicateAddress
            ? t('onboarding.watch_account.duplicate_address')
            : showInvalidError
              ? t('onboarding.watch_account.invalid_address')
              : undefined

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
                description={t('onboarding.watch_account.description')}
            />

            <AddressEntryField
                testID='watch_account_address_input'
                placeholder={t('onboarding.watch_account.address_placeholder')}
                value={address}
                onChangeText={handleAddressChange}
                allowQRCode
                onScanned={handleAddressChange}
                errorMessage={errorMessage}
            />
            {isNfdResolving && (
                <PWView style={styles.nfdStatus}>
                    <ActivityIndicator size='small' />
                    <PWText
                        variant='caption'
                        style={styles.nfdStatusText}
                    >
                        {t('address_entry.nfd_resolving')}
                    </PWText>
                </PWView>
            )}
            {isNfdResolved && nfdName && (
                <PWView style={styles.nfdStatus}>
                    <PWText
                        variant='caption'
                        style={styles.nfdStatusText}
                    >
                        {t('address_entry.nfd_resolved', {
                            name: nfdName,
                        })}
                        {' — '}
                        {truncateAlgorandAddress(resolvedAddress)}
                    </PWText>
                </PWView>
            )}
        </PWScreen>
    )
}
