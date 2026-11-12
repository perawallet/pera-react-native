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

import { PWText } from '@components/core'
import { AddressDisplay } from '@components/AddressDisplay'
import { AssetAmount } from '@components/AssetAmount'
import { KeyValueRow } from '@components/KeyValueRow'
import { useLanguage } from '@hooks/useLanguage'
import { formatDatetime } from '@perawallet/wallet-core-shared'
import { ChainChip } from '@modules/chain-ui/icon'
import { TransactionDetailCard } from '../../TransactionDetailCard'
import type { TransactionDetailSummary } from '../../types'

type TransactionDetailFactsCardProps = {
    summary: TransactionDetailSummary
    /** Shows the amount here when no hero above does. */
    isAmountShown?: boolean
}

export const TransactionDetailFactsCard = ({
    summary,
    isAmountShown = false,
}: TransactionDetailFactsCardProps) => {
    const { t } = useLanguage()
    const { scope, transactionId, timestamp, block, amount } = summary

    return (
        <TransactionDetailCard testID='transaction_detail_facts'>
            <KeyValueRow
                testID='transaction_detail_network'
                title={t('transactions.common.network')}
            >
                <ChainChip
                    chainId={scope.chainId}
                    isBare
                />
            </KeyValueRow>
            {isAmountShown && !!amount && (
                <KeyValueRow
                    testID='transaction_detail_amount'
                    title={t('signing.technical.amount_sent')}
                >
                    <AssetAmount
                        chainId={scope.chainId}
                        asset={amount.asset}
                        value={amount.value}
                        ignorePrivacyMode
                    />
                </KeyValueRow>
            )}
            {!!transactionId && (
                <KeyValueRow
                    testID='transaction_detail_id'
                    title={t('transactions.record_detail.transaction_id')}
                >
                    <AddressDisplay
                        address={transactionId}
                        scope={scope}
                        displayType='address-only'
                        addressFormat='short'
                        textProps={{ variant: 'body' }}
                    />
                </KeyValueRow>
            )}
            {timestamp !== undefined && (
                <KeyValueRow
                    testID='transaction_detail_date'
                    title={t('transactions.common.date')}
                >
                    <PWText>
                        {formatDatetime(
                            new Date(timestamp),
                            undefined,
                            'medium',
                        )}
                    </PWText>
                </KeyValueRow>
            )}
            {!!block && (
                <KeyValueRow
                    testID='transaction_detail_block'
                    title={t(block.labelKey)}
                >
                    <PWText>{block.number}</PWText>
                </KeyValueRow>
            )}
        </TransactionDetailCard>
    )
}
