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

import type { TransactionReplacementKind } from '@perawallet/wallet-core-transactions'
import { PWButton, PWText, PWView } from '@components/core'
import { useLanguage } from '@hooks/useLanguage'
import { useBottomSheetResult } from '@modules/bottom-sheet'
import { useStyles } from './styles'

export type ReplaceTransactionResult = { kind: TransactionReplacementKind }

export const ReplaceTransactionContent = () => {
    const styles = useStyles()
    const { t } = useLanguage()
    const { resolve } = useBottomSheetResult<ReplaceTransactionResult>()

    return (
        <PWView style={styles.container}>
            <PWText
                variant='h3'
                style={styles.title}
            >
                {t('transactions.replacement.title')}
            </PWText>
            <PWText style={styles.body}>
                {t('transactions.replacement.body')}
            </PWText>
            <PWView style={styles.actions}>
                <PWButton
                    testID='replace_transaction_speed_up'
                    variant='primary'
                    title={t('transactions.replacement.speed_up')}
                    onPress={() => resolve({ kind: 'speed-up' })}
                />
                <PWButton
                    testID='replace_transaction_cancel'
                    variant='secondary'
                    title={t('transactions.replacement.cancel')}
                    onPress={() => resolve({ kind: 'cancel' })}
                />
            </PWView>
        </PWView>
    )
}
