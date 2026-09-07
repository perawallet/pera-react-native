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

import { useMemo } from 'react'
import { useTheme } from '@rneui/themed'
import { PWDivider, PWText, PWView } from '@components/core'
import { KeyValueRow } from '@components/KeyValueRow'
import { AddressDisplay } from '@components/AddressDisplay'
import { encodeToBase64 } from '@perawallet/wallet-core-shared'
import type { PeraDisplayableTransaction } from '@perawallet/wallet-core-blockchain'
import { useLanguage } from '@hooks/useLanguage'
import { TransactionHeader } from '../TransactionHeader/TransactionHeader'
import { TransactionFeeRow } from '../TransactionFeeRow/TransactionFeeRow'
import { TransactionNoteRow } from '../TransactionNoteRow/TransactionNoteRow'
import { TransactionWarnings } from '../../TransactionWarnings/TransactionWarnings'
import { TransactionFooter } from '../TransactionFooter/TransactionFooter'
import { useStyles } from './styles'

export type HeartbeatDisplayProps = {
    transaction: PeraDisplayableTransaction
    isInnerTransaction?: boolean
}

/**
 * A heartbeat is submitted by a third party (a proposer's heartbeat service)
 * on behalf of the account named in `hbAddress` — so unlike every other
 * transaction type, the sender is almost never the account whose history this
 * row appears in, and there is no receiver or amount at all.
 */
export const HeartbeatDisplay = ({
    transaction,
    isInnerTransaction = false,
}: HeartbeatDisplayProps) => {
    const styles = useStyles()
    const { theme } = useTheme()
    const { t } = useLanguage()

    const heartbeat = transaction.heartbeatTransaction
    const showWarnings = useMemo(() => !transaction.id, [transaction])
    const voteId = useMemo(
        () =>
            heartbeat?.hbVoteId?.length
                ? encodeToBase64(heartbeat.hbVoteId)
                : undefined,
        [heartbeat?.hbVoteId],
    )

    return (
        <PWView style={styles.container}>
            <TransactionHeader
                transaction={transaction}
                isInnerTransaction={isInnerTransaction}
            />

            {showWarnings && <TransactionWarnings transaction={transaction} />}

            <PWDivider
                style={styles.divider}
                color={theme.colors.layerGray}
            />

            <PWView style={styles.detailContainer}>
                <PWText
                    variant='caption'
                    style={styles.description}
                >
                    {t('transactions.heartbeat.description')}
                </PWText>

                {!!heartbeat?.hbAddress && (
                    <KeyValueRow title={t('transactions.heartbeat.account')}>
                        <AddressDisplay address={heartbeat.hbAddress} />
                    </KeyValueRow>
                )}

                <KeyValueRow title={t('transactions.heartbeat.submitted_by')}>
                    <AddressDisplay address={transaction.sender} />
                </KeyValueRow>

                {heartbeat?.hbKeyDilution !== undefined && (
                    <KeyValueRow
                        title={t('transactions.heartbeat.key_dilution')}
                    >
                        <PWText>{heartbeat.hbKeyDilution.toString()}</PWText>
                    </KeyValueRow>
                )}

                {!!voteId && (
                    <KeyValueRow
                        title={t('transactions.heartbeat.vote_id')}
                        verticalAlignment='top'
                    >
                        <PWText>{voteId}</PWText>
                    </KeyValueRow>
                )}

                <TransactionFeeRow transaction={transaction} />

                <TransactionNoteRow transaction={transaction} />
            </PWView>

            <PWDivider
                style={styles.divider}
                color={theme.colors.layerGray}
            />

            <TransactionFooter transaction={transaction} />
        </PWView>
    )
}
