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

import { useState, useEffect } from 'react'
import { PWBottomSheet, PWButton, PWIcon, PWText } from '@components/core'
import { useLanguage } from '@hooks/useLanguage'
import { useSigningRequest } from '@perawallet/wallet-core-signing'
import { usePreferences } from '@perawallet/wallet-core-settings'
import { deferToNextCycle } from '@perawallet/wallet-core-shared'
import { UserPreferences } from '@constants/user-preferences'
import { useStyles } from './styles'

export const TransactionRequestFAQBottomSheet = () => {
    const { t } = useLanguage()
    const styles = useStyles()
    const { currentRequest } = useSigningRequest()
    const { getPreference, setPreference } = usePreferences()
    const [isVisible, setIsVisible] = useState(false)

    useEffect(() => {
        if (currentRequest) {
            const alreadyShown = getPreference(
                UserPreferences.transactionRequestFaqShown,
            )

            if (!alreadyShown) {
                deferToNextCycle(() => setIsVisible(true))
            }
        } else {
            setIsVisible(false)
        }
    }, [currentRequest, getPreference])

    const handleClose = () => {
        setPreference(UserPreferences.transactionRequestFaqShown, true)
        setIsVisible(false)
    }

    return (
        <PWBottomSheet
            isVisible={isVisible}
            onBackdropPress={handleClose}
            innerContainerStyle={styles.container}
            enablePanDownToClose
        >
            <PWIcon
                name='info'
                variant='primary'
                size='xl'
                style={styles.icon}
            />
            <PWText variant='h3'>
                {t('signing.transaction_request_faq.title')}
            </PWText>
            <PWText style={styles.message}>
                {t('signing.transaction_request_faq.body')}
            </PWText>
            <PWText
                variant='body'
                style={styles.warning}
            >
                {t('signing.transaction_request_faq.warning')}
            </PWText>
            <PWButton
                variant='primary'
                title={t('common.close.label')}
                onPress={handleClose}
                style={styles.button}
            />
        </PWBottomSheet>
    )
}
