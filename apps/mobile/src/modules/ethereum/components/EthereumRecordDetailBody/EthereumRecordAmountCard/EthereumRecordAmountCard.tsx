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

import { Fragment } from 'react'
import type {
    BalanceChange,
    ChainScope,
} from '@perawallet/wallet-core-chain-contract'
import { PWText } from '@components/core'
import { AddressDisplay } from '@components/AddressDisplay'
import { KeyValueRow } from '@components/KeyValueRow'
import { useLanguage } from '@hooks/useLanguage'
import { ChainChip } from '@modules/chain-ui/icon'
import { TransactionDetailCard } from '@modules/signing'
import { EthereumRecordAmountRow } from '../EthereumRecordAmountRow'

type EthereumRecordAmountCardProps = {
    changes: BalanceChange[]
    scope: ChainScope
    /** Names the asset moved, for a summary the balance legs alone can't say which of. */
    assetLabel?: string
    /** The token contract of the asset moved, shown beside it so a lookalike name can be checked. */
    assetContract?: string
    /** Titles each leg by its side, what left and what arrived, rather than as a bare amount. */
    isSwap?: boolean
}

/** What the history says happened to the balances, whether or not the call was read. */
export const EthereumRecordAmountCard = ({
    changes,
    scope,
    assetLabel,
    assetContract,
    isSwap = false,
}: EthereumRecordAmountCardProps) => {
    const { t } = useLanguage()
    // A cross-chain swap's legs are on different networks, so each names its own.
    const isCrossChain =
        isSwap &&
        new Set(changes.map(change => change.assetRef.chainId)).size > 1

    if (changes.length === 0 && !assetLabel && !assetContract) {
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
            {!!assetContract && (
                <KeyValueRow
                    testID='ethereum_record_asset_contract'
                    title={t('transactions.common.asset')}
                >
                    <AddressDisplay
                        address={assetContract}
                        displayType='address-only'
                        scope={scope}
                    />
                </KeyValueRow>
            )}
            {changes.map((change, index) => (
                <Fragment key={`${change.assetRef.assetId}-${index}`}>
                    <EthereumRecordAmountRow
                        change={change}
                        scope={{ ...scope, chainId: change.assetRef.chainId }}
                        title={
                            isSwap
                                ? t(
                                      change.value.isNegative()
                                          ? 'transactions.list_item.send'
                                          : 'transactions.list_item.receive',
                                  )
                                : undefined
                        }
                        testID={`ethereum_record_amount_${index}`}
                    />
                    {isCrossChain && (
                        <KeyValueRow
                            testID={`ethereum_record_amount_network_${index}`}
                            title={t('transactions.common.network')}
                        >
                            <ChainChip
                                chainId={change.assetRef.chainId}
                                isBare
                            />
                        </KeyValueRow>
                    )}
                </Fragment>
            ))}
        </TransactionDetailCard>
    )
}
