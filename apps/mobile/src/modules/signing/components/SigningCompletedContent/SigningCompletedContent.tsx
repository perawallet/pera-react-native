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

import { PWButton, PWIcon, PWText, PWView } from '@components/core'
import { useBottomSheetResult } from '@modules/bottom-sheet'
import { useLanguage } from '@hooks/useLanguage'
import { useStyles } from './styles'

export type SigningCompletedContentProps = {
    /** Whether the completed request was a transaction (vs arbitrary-data). */
    isTransaction: boolean
}

export const SigningCompletedContent = ({
    isTransaction,
}: SigningCompletedContentProps) => {
    const { t } = useLanguage()
    const styles = useStyles()
    const { dismiss } = useBottomSheetResult<void>()

    return (
        <PWView style={styles.container}>
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
                onPress={dismiss}
            />
        </PWView>
    )
}
