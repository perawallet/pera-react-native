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

import { ChainNotice } from '@components/ChainNotice'
import { PWLoadingIndicator, PWView } from '@components/core'
import type { RecordDetailBodyProps } from '@modules/signing'
import { useEthereumRecordDetail } from '../../hooks/useEthereumRecordDetail'
import { EthereumTransactionDetailBody } from '../EthereumTransactionDetailBody'
import { EthereumRecordFacts } from './EthereumRecordFacts'
import { EthereumRecordSummary } from './EthereumRecordSummary'
import { useStyles } from './styles'

/**
 * Always what the history gave. Once the node's copy is read it is shown in
 * place of the plain summary, so an approval or transfer reads as it did at
 * signing; the balance changes stay below it either way.
 */
export const EthereumRecordDetailBody = ({ record }: RecordDetailBodyProps) => {
    const styles = useStyles()
    const { transaction, isLoading, isReadFailed } =
        useEthereumRecordDetail(record)
    const isUndecodedCall =
        record.summary.kind === 'contract-call' &&
        !transaction &&
        !isLoading &&
        !isReadFailed

    return (
        <PWView style={styles.container}>
            {transaction ? (
                <EthereumTransactionDetailBody
                    transaction={transaction}
                    scope={record.scope}
                />
            ) : (
                <EthereumRecordSummary record={record} />
            )}
            {isLoading && (
                <PWLoadingIndicator testID='ethereum_record_loading' />
            )}
            {isReadFailed && (
                <ChainNotice
                    kind='warning'
                    titleKey='transactions.record_detail.read_failed'
                    testID='ethereum_record_read_failed'
                />
            )}
            {isUndecodedCall && (
                <ChainNotice
                    kind='warning'
                    titleKey='transactions.contract_call.warning'
                    testID='ethereum_record_undecoded_warning'
                />
            )}
            <EthereumRecordFacts record={record} />
        </PWView>
    )
}
