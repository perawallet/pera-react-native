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

import { memo } from 'react'
import type { ChainId } from '@perawallet/wallet-core-chain-contract'
import { PWListItemLayout, PWText, PWView } from '@components/core'
import { ChainNotice } from '@components/ChainNotice'
import { CurrencyAmount } from '@components/CurrencyAmount'
import { TransactionIcon } from '@components/TransactionIcon'
import { useLanguage } from '@hooks/useLanguage'
import { ChainLabel } from '@modules/chain-ui/icon'
import { useStyles } from './styles'
import {
    useTransactionListItem,
    type UseTransactionListItemParams,
} from './useTransactionListItem'
import type { AmountDisplay } from './amounts'

export type TransactionListItemProps = UseTransactionListItemParams & {
    /** Labels the row with its network, on a list that mixes them. */
    networkChainId?: ChainId
}

const TransactionListItemView = ({
    networkChainId,
    ...props
}: TransactionListItemProps) => {
    const { id } = 'record' in props ? props.record : props.transaction
    const styles = useStyles()
    const { t } = useLanguage()
    const {
        iconName,
        title,
        subtitle,
        subtitleEllipsizeMode,
        amounts,
        amountsOverflowCount,
        fee,
        feeLabel,
        notice,
        handlePress,
        handleLongPress,
        isSuspectedPoisoning,
        imitatedCurrency,
    } = useTransactionListItem(props)

    const getAmountStyle = (amount: AmountDisplay) => {
        if (amount.prefix === '+') return styles.amountPositive
        if (amount.prefix === '-') return styles.amountNegative
        return styles.amount
    }

    return (
        <PWListItemLayout
            testID={`transaction_row_${id}`}
            style={styles.container}
            // A title alone (a swap) sits centred against its stacked amounts.
            align={
                subtitle ||
                networkChainId ||
                notice ||
                isSuspectedPoisoning ||
                imitatedCurrency !== null
                    ? 'top'
                    : 'center'
            }
            onPress={handlePress}
            onLongPress={handleLongPress}
            left={
                <TransactionIcon
                    name={iconName}
                    size='md'
                />
            }
            right={
                <PWView style={styles.amountContainer}>
                    {amounts.map((amount, index) => (
                        <CurrencyAmount
                            chainId={amount.chainId}
                            key={index}
                            value={amount.value}
                            currency={amount.currency}
                            assetId={amount.assetId}
                            precision='compact'
                            assetDecimals={amount.decimals}
                            prefix={amount.prefix}
                            showSymbol
                            symbolPosition='end'
                            style={getAmountStyle(amount)}
                            variant='h4'
                        />
                    ))}
                    {amountsOverflowCount > 0 && (
                        <PWText style={styles.amountOverflow}>
                            {t('transactions.list_item.more_impacts', {
                                count: amountsOverflowCount,
                            })}
                        </PWText>
                    )}
                    {fee && (
                        <PWView style={styles.fee}>
                            <PWText style={styles.feeText}>{feeLabel}</PWText>
                            <CurrencyAmount
                                chainId={fee.chainId}
                                value={fee.value}
                                currency={fee.currency}
                                assetId={fee.assetId}
                                precision='compact'
                                assetDecimals={fee.decimals}
                                showSymbol
                                symbolPosition='end'
                                style={styles.feeText}
                            />
                        </PWView>
                    )}
                </PWView>
            }
        >
            <PWView>
                {/* The amounts never shrink, so a long swap pair needs a third line to keep the received token in view. */}
                <PWText
                    variant='h4'
                    style={styles.title}
                    truncate
                    numberOfLines={3}
                >
                    {title}
                </PWText>
                {subtitle && (
                    <PWText
                        style={styles.subtitle}
                        truncate
                        ellipsizeMode={subtitleEllipsizeMode}
                    >
                        {subtitle}
                    </PWText>
                )}
                {networkChainId && (
                    <ChainLabel
                        chainId={networkChainId}
                        style={styles.network}
                    />
                )}
                {notice && (
                    <ChainNotice
                        {...notice}
                        style={styles.notice}
                        testID={`transaction_row_notice_${id}`}
                    />
                )}
                {isSuspectedPoisoning && (
                    <ChainNotice
                        kind='warning'
                        titleKey='transactions.suspected_poisoning.marker'
                        style={styles.notice}
                        testID={`transaction_row_suspected_poisoning_${id}`}
                    />
                )}
                {imitatedCurrency !== null && (
                    <ChainNotice
                        kind='warning'
                        titleKey='asset.imitated_currency.marker'
                        params={{ code: imitatedCurrency }}
                        style={styles.notice}
                        testID={`transaction_row_imitated_currency_${id}`}
                    />
                )}
            </PWView>
        </PWListItemLayout>
    )
}

/**
 * Rows carry their own query observers (name reverse lookup, asset details), so
 * a parent re-render — pagination, a refetch, a store write — used to re-run
 * every mounted row's hooks. `transaction` / `record` come straight from the
 * query cache and `onPress` from a `useCallback`, so the default shallow
 * comparison holds.
 */
export const TransactionListItem = memo(TransactionListItemView)
