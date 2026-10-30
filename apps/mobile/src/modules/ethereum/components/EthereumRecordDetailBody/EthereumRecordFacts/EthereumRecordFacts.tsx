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

import type { TransactionRecord } from '@perawallet/wallet-core-chain-contract'
import { formatDatetime } from '@perawallet/wallet-core-shared'
import { PWText, PWView } from '@components/core'
import { CopyableText } from '@components/CopyableText'
import { KeyValueRow } from '@components/KeyValueRow'
import { useLanguage } from '@hooks/useLanguage'
import { isEvmTransactionHash } from '@modules/ethereum/utils/isEvmTransactionHash'
import { recordAmountsOf } from '@modules/ethereum/utils/recordAmountsOf'
import { EthereumRecordAmountRow } from '../EthereumRecordAmountRow'
import { useStyles } from './styles'

type EthereumRecordFactsProps = {
    record: TransactionRecord
}

/** What the history says happened, whether or not the call was read: when, the balance changes, and the id. */
export const EthereumRecordFacts = ({ record }: EthereumRecordFactsProps) => {
    const styles = useStyles()
    const { t } = useLanguage()
    const amounts = recordAmountsOf(record.summary)

    return (
        <PWView style={styles.container}>
            {record.timestamp !== undefined && (
                <KeyValueRow
                    testID='ethereum_record_date'
                    title={t('transactions.common.date')}
                >
                    <PWText>
                        {formatDatetime(new Date(record.timestamp))}
                    </PWText>
                </KeyValueRow>
            )}
            {amounts.map((change, index) => (
                <EthereumRecordAmountRow
                    key={`${change.assetRef.assetId}-${index}`}
                    change={change}
                    scope={record.scope}
                    testID={`ethereum_record_amount_${index}`}
                />
            ))}
            {isEvmTransactionHash(record.id) && (
                <KeyValueRow
                    testID='ethereum_record_id'
                    title={t('transactions.record_detail.transaction_id')}
                >
                    <CopyableText copyValue={record.id}>
                        <PWText>{record.id}</PWText>
                    </CopyableText>
                </KeyValueRow>
            )}
        </PWView>
    )
}
