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

import { useTheme } from '@rneui/themed'
import type { TransactionRecord } from '@perawallet/wallet-core-chain-contract'
import { useNativeAsset } from '@perawallet/wallet-core-assets'
import { baseUnitsToDisplayUnits } from '@perawallet/wallet-core-shared'
import { PWDivider, PWText, PWView } from '@components/core'
import { AddressDisplay } from '@components/AddressDisplay'
import { AssetAmount } from '@components/AssetAmount'
import { KeyValueRow } from '@components/KeyValueRow'
import {
    TransactionIcon,
    transactionIconName,
} from '@components/TransactionIcon'
import { useLanguage } from '@hooks/useLanguage'
import { useStyles } from './styles'

type EthereumRecordSummaryProps = {
    record: TransactionRecord
}

/** The record as the backend summarised it: no calldata, so no spender or amount of an approval. */
export const EthereumRecordSummary = ({
    record,
}: EthereumRecordSummaryProps) => {
    const styles = useStyles()
    const { theme } = useTheme()
    const { t } = useLanguage()
    const { summary, fee, scope, initiator } = record
    const nativeAsset = useNativeAsset(scope)
    // The counterparty is the sender of a payment received, and of a call
    // another party made.
    const isFromCounterparty =
        summary.direction === 'in' ||
        (!!initiator &&
            summary.counterparty?.toLowerCase() === initiator.toLowerCase())

    return (
        <PWView style={styles.container}>
            <PWView style={styles.header}>
                <TransactionIcon
                    size='md'
                    name={transactionIconName(summary.icon)}
                />
                <PWView style={styles.titles}>
                    <PWText
                        style={styles.title}
                        truncate
                    >
                        {t(summary.title.key, summary.title.params)}
                    </PWText>
                    {!!summary.subtitle && (
                        <PWText
                            style={styles.subtitle}
                            variant='caption'
                            truncate
                        >
                            {t(summary.subtitle.key, summary.subtitle.params)}
                        </PWText>
                    )}
                </PWView>
            </PWView>

            <PWDivider
                style={styles.divider}
                color={theme.colors.layerGray}
            />

            <PWView style={styles.detailContainer}>
                {!!summary.counterparty && (
                    <KeyValueRow
                        testID='ethereum_record_counterparty'
                        title={
                            isFromCounterparty
                                ? t('transactions.common.from')
                                : t('transactions.common.to')
                        }
                    >
                        <AddressDisplay
                            address={summary.counterparty}
                            displayType='address-only'
                        />
                    </KeyValueRow>
                )}
                {!!fee && !isFromCounterparty && (
                    <KeyValueRow
                        testID='ethereum_record_fee'
                        title={t('transactions.common.fee')}
                    >
                        <AssetAmount
                            asset={nativeAsset}
                            value={baseUnitsToDisplayUnits(
                                fee,
                                nativeAsset.decimals,
                            )}
                            showSymbol
                            ignorePrivacyMode
                        />
                    </KeyValueRow>
                )}
            </PWView>
        </PWView>
    )
}
