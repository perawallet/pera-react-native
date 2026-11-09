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
import { PWLoadingIndicator } from '@components/core'
import type { RecordDetailBodyProps } from '@modules/signing'
import { EthereumRecordReadBody } from './EthereumRecordReadBody'
import { EthereumRecordSummary } from './EthereumRecordSummary'
import { useEthereumRecordDetailBody } from './useEthereumRecordDetailBody'

/**
 * Always what the history gave. Once the node's copy is read it is shown in
 * place of the plain summary, so an approval or transfer reads as it did at
 * signing; the balance changes stay below it either way.
 */
export const EthereumRecordDetailBody = ({ record }: RecordDetailBodyProps) => {
    const {
        transaction,
        isLoading,
        isReadFailed,
        isUndecodedCall,
        isInferredTitle,
    } = useEthereumRecordDetailBody(record)

    if (transaction) {
        return (
            <EthereumRecordReadBody
                record={record}
                transaction={transaction}
            />
        )
    }

    return (
        <EthereumRecordSummary
            record={record}
            warnings={
                <>
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
                    {isInferredTitle && (
                        <ChainNotice
                            kind='warning'
                            titleKey='transactions.record_detail.inferred_notice'
                            testID='ethereum_record_inferred_notice'
                        />
                    )}
                </>
            }
        />
    )
}
