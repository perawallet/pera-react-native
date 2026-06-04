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

import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { PWButton, PWIcon, PWText, PWView } from '@components/core'
import { useBottomSheetResult } from '@modules/bottom-sheet'
import { useLanguage } from '@hooks/useLanguage'
import { useStyles } from './styles'

export type TransactionRequestFAQContentProps = Record<string, never>

export const TransactionRequestFAQContent = (
    _props: TransactionRequestFAQContentProps = {},
) => {
    const { t } = useLanguage()
    const insets = useSafeAreaInsets()
    const styles = useStyles({ bottomInset: insets.bottom })
    const { dismiss } = useBottomSheetResult<void>()

    return (
        <PWView style={styles.container}>
            <PWIcon
                name='info'
                variant='primary'
                size='xl'
                style={styles.icon}
            />
            <PWText
                variant='h3'
                style={styles.title}
            >
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
                onPress={dismiss}
                style={styles.button}
            />
        </PWView>
    )
}
