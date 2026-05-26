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

import { useMemo } from 'react'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { PWButton, PWIcon, PWText, PWView } from '@components/core'
import { useBottomSheetResult } from '@modules/bottom-sheet'
import { useLanguage } from '@hooks/useLanguage'
import { config } from '@perawallet/wallet-core-config'
import type { Nullable } from '@perawallet/wallet-core-shared'
import { useStyles } from './styles'

export type WalletConnectErrorContentProps = {
    error: Nullable<Error>
}

export const WalletConnectErrorContent = ({
    error,
}: WalletConnectErrorContentProps) => {
    const { t } = useLanguage()
    const insets = useSafeAreaInsets()
    const styles = useStyles({ bottomInset: insets.bottom })
    const { dismiss } = useBottomSheetResult<void>()

    const errorMessage = useMemo(() => {
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
        <PWView style={styles.container}>
            <PWIcon
                name='warning'
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
                onPress={dismiss}
            />
        </PWView>
    )
}
