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
import { deferToNextCycle } from '@perawallet/wallet-core-shared'
import { useStyles } from './styles'

export const SigningCompletedBottomSheet = () => {
    const { t } = useLanguage()
    const styles = useStyles()
    const { lastCompletedRequest, clearLastCompletedRequest } =
        useSigningRequest()
    const [isVisible, setIsVisible] = useState(false)

    const isTransaction = lastCompletedRequest?.type === 'transactions'

    useEffect(() => {
        if (lastCompletedRequest) {
            deferToNextCycle(() => setIsVisible(true))
        } else {
            setIsVisible(false)
        }
    }, [lastCompletedRequest])

    const handleDismiss = () => {
        setIsVisible(false)
        clearLastCompletedRequest()
    }

    return (
        <PWBottomSheet
            isVisible={isVisible}
            onBackdropPress={handleDismiss}
            innerContainerStyle={styles.container}
        >
            <PWIcon
                name={isTransaction ? 'info' : 'check'}
                variant={isTransaction ? 'primary' : 'positive'}
                size='xl'
                style={styles.icon}
            />
            <PWText variant='h3'>
                {isTransaction
                    ? t('signing.signing_completed.transaction_title')
                    : t('signing.signing_completed.data_title')}
            </PWText>
            <PWText style={styles.message}>
                {isTransaction
                    ? t('signing.signing_completed.transaction_body')
                    : t('signing.signing_completed.data_body')}
            </PWText>
            <PWButton
                variant='primary'
                title={t('common.done')}
                onPress={handleDismiss}
            />
        </PWBottomSheet>
    )
}
