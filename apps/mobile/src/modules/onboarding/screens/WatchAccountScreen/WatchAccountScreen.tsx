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
import { PWButton, PWText, PWView } from '@components/core'
import { AddressEntryField } from '@components/AddressEntryField'
import { useWatchAccountScreen } from './useWatchAccountScreen'
import { useStyles } from './styles'
import { useLanguage } from '@hooks/useLanguage'

export const WatchAccountScreen = () => {
    const styles = useStyles()
    const { t } = useLanguage()
    const {
        address,
        isValidAddress,
        isDuplicateAddress,
        handleAddressChange,
        handleWatchAccount,
    } = useWatchAccountScreen()

    const errorMessage =
        address.length > 0 && isDuplicateAddress
            ? t('onboarding.watch_account.duplicate_address')
            : address.length > 0 && !isValidAddress
              ? t('onboarding.watch_account.invalid_address')
              : undefined

    return (
        <PWView style={styles.rootContainer}>
            <PWView style={styles.contentContainer}>
                <PWText variant='h1'>
                    {t('onboarding.watch_account.title')}
                </PWText>

                <PWText style={styles.description}>
                    {t('onboarding.watch_account.description')}
                </PWText>

                <AddressEntryField
                    testID='watch_account_address_input'
                    label={t('onboarding.watch_account.address_label')}
                    placeholder={t(
                        'onboarding.watch_account.address_placeholder',
                    )}
                    value={address}
                    onChangeText={handleAddressChange}
                    allowQRCode
                    onScanned={handleAddressChange}
                    errorMessage={errorMessage}
                />
            </PWView>

            <PWView style={styles.footerContainer}>
                <PWButton
                    testID='watch_account_submit_button'
                    variant='primary'
                    title={t('onboarding.watch_account.watch_button')}
                    onPress={handleWatchAccount}
                    isDisabled={!isValidAddress || isDuplicateAddress}
                />
            </PWView>
        </PWView>
    )
}
