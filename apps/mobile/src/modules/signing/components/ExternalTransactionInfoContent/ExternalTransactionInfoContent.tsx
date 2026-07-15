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

import { PWButton, PWText, PWView } from '@components/core'
import { useBottomSheetResult } from '@modules/bottom-sheet'
import { useLanguage } from '@hooks/useLanguage'
import { useStyles } from './styles'

export type ExternalTransactionInfoContentProps = Record<string, never>

export const ExternalTransactionInfoContent = (
    _props: ExternalTransactionInfoContentProps = {},
) => {
    const { t } = useLanguage()
    const styles = useStyles()
    const { dismiss } = useBottomSheetResult<void>()

    return (
        <PWView style={styles.container}>
            <PWText variant='h3'>
                {t('signing.external_transaction.sheet_title')}
            </PWText>
            <PWText style={styles.message}>
                {t('signing.external_transaction.sheet_body')}
            </PWText>
            <PWButton
                variant='primary'
                title={t('signing.external_transaction.sheet_dismiss')}
                onPress={dismiss}
                style={styles.button}
            />
        </PWView>
    )
}
