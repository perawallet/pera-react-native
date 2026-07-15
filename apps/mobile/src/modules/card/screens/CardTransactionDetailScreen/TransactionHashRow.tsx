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

import { PWIcon, PWText, PWTouchableOpacity, PWView } from '@components/core'
import { useLanguage } from '@hooks/useLanguage'
import { useTransactionHashRow } from './useTransactionHashRow'
import { useStyles } from './styles'

type TransactionHashRowProps = {
    txHash: string
    /** The funding leg's network (e.g. "algorand", "linea"). */
    network: string
}

export const TransactionHashRow = ({
    txHash,
    network,
}: TransactionHashRowProps) => {
    const styles = useStyles()
    const { t } = useLanguage()
    const { truncatedHash, onCopy, onOpenExplorer } = useTransactionHashRow(
        txHash,
        network,
    )

    return (
        <PWView style={[styles.detailRow, styles.hashRow]}>
            <PWView style={styles.hashTextBlock}>
                <PWText
                    variant='footnoteMedium'
                    style={styles.detailRowLabel}
                >
                    {t('peraCard.transactions.detail_transaction_hash')}
                </PWText>
                <PWText
                    variant='body'
                    numberOfLines={1}
                >
                    {truncatedHash}
                </PWText>
            </PWView>
            <PWView style={styles.hashActions}>
                {onOpenExplorer ? (
                    <PWTouchableOpacity
                        style={styles.hashActionButton}
                        onPress={onOpenExplorer}
                        testID='card_transaction_detail_open_explorer'
                        accessibilityLabel={t(
                            'peraCard.transactions.detail_open_explorer_accessibility_label',
                        )}
                    >
                        <PWIcon name='arrow-up-right' />
                    </PWTouchableOpacity>
                ) : null}
                <PWTouchableOpacity
                    style={styles.hashActionButton}
                    onPress={onCopy}
                    testID='card_transaction_detail_copy_hash'
                    accessibilityLabel={t(
                        'peraCard.transactions.detail_copy_hash_accessibility_label',
                    )}
                >
                    <PWIcon name='copy' />
                </PWTouchableOpacity>
            </PWView>
        </PWView>
    )
}
