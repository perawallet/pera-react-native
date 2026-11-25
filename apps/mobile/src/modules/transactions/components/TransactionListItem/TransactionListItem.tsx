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
import {
    PWIcon,
    PWListItemLayout,
    PWText,
    PWTouchableOpacity,
    PWView,
} from '@components/core'
import { ChainNotice } from '@components/ChainNotice'
import { CurrencyAmount } from '@components/CurrencyAmount'
import { PreferredAmount } from '@components/PreferredAmount'
import { TransactionLeadingIcon } from '@components/TransactionLeadingIcon'
import { useLanguage } from '@hooks/useLanguage'
import { useStyles } from './styles'
import { rowAmountPrecision } from './amounts'
import {
    useTransactionListItem,
    type UseTransactionListItemParams,
    type RowAmount,
} from './useTransactionListItem'

// A token's own unit has no length cap, so the amount column is capped and cuts off rather than squeezing the title.
const AMOUNT_MAX_WIDTH_RATIO = 0.5

export type TransactionListItemProps = UseTransactionListItemParams

const TransactionListItemView = (props: TransactionListItemProps) => {
    const { id } = 'record' in props ? props.record : props.transaction
    const styles = useStyles()
    const { t } = useLanguage()
    const {
        iconName,
        title,
        subtitle,
        subtitleEllipsizeMode,
        amounts,
        fiatValue,
        amountsOverflowCount,
        fee,
        feeLabel,
        notice,
        handlePress,
        handleLongPress,
        isSuspicious,
        suspicionTitle,
        handleSuspiciousPress,
        leadingChainIds,
        leadingAssets,
    } = useTransactionListItem(props)

    // A scam airdrop isn't a credit: no green amount to make it look like one.
    // Only its own leg: the real coin beside it in a swap keeps its colour.
    const getAmountStyle = (amount: RowAmount) => {
        if (amount.isMuted) return styles.amountMuted
        if (amount.prefix === '+') return styles.amountPositive
        if (amount.prefix === '-') return styles.amountNegative
        return styles.amount
    }

    return (
        <PWListItemLayout
            testID={`transaction_row_${id}`}
            style={[styles.container, isSuspicious && styles.suspicious]}
            // A title alone sits centred against its stacked amounts.
            align={subtitle || notice ? 'top' : 'center'}
            rightMaxWidthRatio={AMOUNT_MAX_WIDTH_RATIO}
            onPress={handlePress}
            onLongPress={handleLongPress}
            left={
                <TransactionLeadingIcon
                    iconName={iconName}
                    leadingAssets={leadingAssets}
                    chainIds={leadingChainIds}
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
                            precision={rowAmountPrecision(amount.decimals)}
                            abbreviateFrom='million'
                            assetDecimals={amount.decimals}
                            prefix={amount.prefix}
                            showSymbol
                            symbolPosition='end'
                            style={getAmountStyle(amount)}
                            variant='h4'
                        />
                    ))}
                    {fiatValue && (
                        <PreferredAmount
                            value={fiatValue}
                            density='compact'
                            showSymbol
                            style={styles.fiatAmount}
                        />
                    )}
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
                <PWView style={styles.titleRow}>
                    <PWText
                        variant='h4'
                        style={isSuspicious ? styles.titleMuted : styles.title}
                        truncate
                    >
                        {title}
                    </PWText>
                    {isSuspicious && (
                        <PWTouchableOpacity
                            onPress={handleSuspiciousPress}
                            hitSlop={styles.badgeHitSlop}
                            accessibilityRole='button'
                            accessibilityLabel={suspicionTitle ?? undefined}
                            testID={`transaction_row_suspicious_${id}`}
                        >
                            <PWIcon
                                name='assets/suspicious'
                                size='sm'
                            />
                        </PWTouchableOpacity>
                    )}
                </PWView>
                {subtitle && (
                    <PWText
                        style={styles.subtitle}
                        truncate
                        ellipsizeMode={subtitleEllipsizeMode}
                    >
                        {subtitle}
                    </PWText>
                )}
                {notice && (
                    <ChainNotice
                        {...notice}
                        style={styles.notice}
                        testID={`transaction_row_notice_${id}`}
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
