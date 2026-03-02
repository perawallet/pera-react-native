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

import { PWBottomSheet, PWButton, PWIcon, PWText } from '@components/core'
import { useLanguage } from '@hooks/useLanguage'
import { useStyles } from './styles'
import { useMemo } from 'react'
import { logger } from '@perawallet/wallet-core-shared'
import { config } from '@perawallet/wallet-core-config'

type WalletConnectErrorBottomSheetProps = {
    isVisible: boolean
    error: Error | null
    onClose: () => void
}

export const WalletConnectErrorBottomSheet = ({
    isVisible,
    error,
    onClose,
}: WalletConnectErrorBottomSheetProps) => {
    const { t } = useLanguage()
    const styles = useStyles()

    const errorMessage = useMemo(() => {
        logger.debug('Handling error', { error })
        let actualError = error?.message
        if (config.debugEnabled && error?.cause) {
            if (typeof error.cause === 'string') {
                actualError = error.cause
            } else if (error.cause instanceof Error) {
                actualError = error.cause.message
            }
        }

        return actualError ?? 'errors.walletconnect.unknown'
    }, [error])

    return (
        <PWBottomSheet
            isVisible={isVisible}
            onBackdropPress={onClose}
            innerContainerStyle={styles.container}
        >
            <PWIcon
                name='info'
                variant='error'
                size='xl'
                style={styles.icon}
            />
            <PWText variant='h3'>
                {t('walletconnect.request.error_sheet_title')}
            </PWText>
            <PWText style={styles.message}>
                {t('walletconnect.request.error_sheet_body')}
            </PWText>
            <PWText style={styles.errorMessage}>{t(errorMessage)}</PWText>
            <PWText style={styles.retryMessage}>
                {t('walletconnect.request.error_sheet_retry')}
            </PWText>
            <PWButton
                variant='secondary'
                title={t('common.ok.label')}
                onPress={onClose}
            />
        </PWBottomSheet>
    )
}
