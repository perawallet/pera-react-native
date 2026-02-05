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

import { PeraDisplayableTransaction } from '@perawallet/wallet-core-blockchain'
import { PWText, PWView } from '@components/core'
import { useStyles } from './styles'
import { useLanguage } from '@hooks/useLanguage'

type AppCallSummaryHeaderProps = {
    transaction: PeraDisplayableTransaction
}

export const AppCallSummaryHeader = ({
    transaction,
}: AppCallSummaryHeaderProps) => {
    const styles = useStyles()
    const { t } = useLanguage()
    return (
        <PWView style={styles.container}>
            <PWText style={styles.typeText}>
                {t(`transactions.type.${transaction.txType}`)}
            </PWText>
            <PWText>
                {t('transactions.summary.app_id', {
                    id:
                        transaction.applicationTransaction?.applicationId ??
                        'unknown',
                })}
            </PWText>
        </PWView>
    )
}
