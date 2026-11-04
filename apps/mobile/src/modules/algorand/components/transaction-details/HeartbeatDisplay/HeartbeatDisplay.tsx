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

import { useSelectedScope } from '@perawallet/wallet-core-chain-shared'
import { useMemo } from 'react'
import { PWText } from '@components/core'
import { KeyValueRow } from '@components/KeyValueRow'
import { encodeToBase64 } from '@perawallet/wallet-core-shared'
import type { AlgorandTransactionView } from '@perawallet/wallet-core-chain-algorand/blockchain'
import { ALGORAND_CHAIN_ID } from '@perawallet/wallet-core-chain-algorand/descriptor'
import { useLanguage } from '@hooks/useLanguage'
import {
    TransactionDetailAddress,
    TransactionDetailCard,
} from '@modules/signing'
import { useStyles } from './styles'

export type HeartbeatDisplayProps = {
    transaction: AlgorandTransactionView
}

/**
 * A heartbeat is submitted by a third party (a proposer's heartbeat service)
 * on behalf of the account named in `hbAddress`, so the shared sender is
 * almost never the account whose history this row appears in, and there is no
 * receiver or amount at all.
 */
export const HeartbeatDisplay = ({ transaction }: HeartbeatDisplayProps) => {
    const styles = useStyles()
    const { t } = useLanguage()
    const scope = useSelectedScope(ALGORAND_CHAIN_ID)

    const heartbeat = transaction.heartbeatTransaction
    const voteId = useMemo(
        () =>
            heartbeat?.hbVoteId?.length
                ? encodeToBase64(heartbeat.hbVoteId)
                : undefined,
        [heartbeat?.hbVoteId],
    )

    return (
        <TransactionDetailCard>
            <PWText
                variant='caption'
                style={styles.description}
            >
                {t('transactions.heartbeat.description')}
            </PWText>

            {!!heartbeat?.hbAddress && (
                <KeyValueRow title={t('transactions.heartbeat.account')}>
                    <TransactionDetailAddress
                        address={heartbeat.hbAddress}
                        scope={scope}
                    />
                </KeyValueRow>
            )}

            {heartbeat?.hbKeyDilution !== undefined && (
                <KeyValueRow title={t('transactions.heartbeat.key_dilution')}>
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
        </TransactionDetailCard>
    )
}
