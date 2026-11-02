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
import { formatDatetime } from '@perawallet/wallet-core-shared'
import { chainDisplayNameOf } from '@perawallet/wallet-core-chain-shared'
import { getIconPixelSize, PWText, PWView } from '@components/core'
import { AddressDisplay } from '@components/AddressDisplay'
import { KeyValueRow } from '@components/KeyValueRow'
import { useLanguage } from '@hooks/useLanguage'
import { ChainIcon } from '@modules/chain-ui/icon'
import { TransactionDetailCard } from '../../TransactionDetailCard'
import type { TransactionDetailSummary } from '../../types'
import { useStyles } from './styles'

type TransactionDetailFactsCardProps = {
    summary: TransactionDetailSummary
}

export const TransactionDetailFactsCard = ({
    summary,
}: TransactionDetailFactsCardProps) => {
    const { t } = useLanguage()
    const { theme } = useTheme()
    const styles = useStyles()
    const { scope, transactionId, timestamp, block } = summary

    return (
        <TransactionDetailCard testID='transaction_detail_facts'>
            <KeyValueRow
                testID='transaction_detail_network'
                title={t('transactions.common.network')}
            >
                <PWView style={styles.network}>
                    <ChainIcon
                        chainId={scope.chainId}
                        size={getIconPixelSize(theme, 'sm')}
                    />
                    <PWText
                        variant='bodyLarge'
                        style={styles.value}
                        numberOfLines={1}
                    >
                        {chainDisplayNameOf(scope.chainId) ?? scope.chainId}
                    </PWText>
                </PWView>
            </KeyValueRow>
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
                        textProps={{
                            variant: 'bodyLarge',
                            style: styles.value,
                        }}
                        hugContent
                        style={styles.address}
                    />
                </KeyValueRow>
            )}
            {timestamp !== undefined && (
                <KeyValueRow
                    testID='transaction_detail_date'
                    title={t('transactions.common.date')}
                >
                    <PWText
                        variant='bodyLarge'
                        style={styles.value}
                    >
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
                    <PWText
                        variant='bodyLarge'
                        style={styles.value}
                    >
                        {block.number}
                    </PWText>
                </KeyValueRow>
            )}
        </TransactionDetailCard>
    )
}
