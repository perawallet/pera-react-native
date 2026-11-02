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

import type {
    BalanceChange,
    ChainScope,
} from '@perawallet/wallet-core-chain-contract'
import { PWText } from '@components/core'
import { KeyValueRow } from '@components/KeyValueRow'
import { useLanguage } from '@hooks/useLanguage'
import { TransactionDetailCard } from '@modules/signing'
import { EthereumRecordAmountRow } from '../EthereumRecordAmountRow'

type EthereumRecordAmountCardProps = {
    changes: BalanceChange[]
    scope: ChainScope
    /** Names the asset moved, for a summary the balance legs alone can't say which of. */
    assetLabel?: string
}

/** What the history says happened to the balances, whether or not the call was read. */
export const EthereumRecordAmountCard = ({
    changes,
    scope,
    assetLabel,
}: EthereumRecordAmountCardProps) => {
    const { t } = useLanguage()

    if (changes.length === 0 && !assetLabel) {
        return null
    }

    return (
        <TransactionDetailCard>
            {!!assetLabel && (
                <KeyValueRow
                    testID='ethereum_record_asset'
                    title={t('transactions.common.asset')}
                >
                    <PWText>{assetLabel}</PWText>
                </KeyValueRow>
            )}
            {changes.map((change, index) => (
                <EthereumRecordAmountRow
                    key={`${change.assetRef.assetId}-${index}`}
                    change={change}
                    scope={scope}
                    testID={`ethereum_record_amount_${index}`}
                />
            ))}
        </TransactionDetailCard>
    )
}
