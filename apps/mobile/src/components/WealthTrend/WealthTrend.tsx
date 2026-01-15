/*
 Copyright 2022-2025 Pera Wallet, LDA
 Licensed under the Apache License, Version 2.0 (the "License");
 you may not use this file except in compliance with the License.
 You may obtain a copy of the License at http://www.apache.org/licenses/LICENSE-2.0
 Unless required by applicable law or agreed to in writing, software
 distributed under the License is distributed on an "AS IS" BASIS,
 WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 See the License for the specific language governing permissions and
 limitations under the License
 */

import { PWIcon, PWText, PWView } from '@components/core'
import { useStyles } from './styles'
import { formatCurrency, HistoryPeriod } from '@perawallet/wallet-core-shared'
import { useMemo } from 'react'
import Decimal from 'decimal.js'
import { useSettings } from '@perawallet/wallet-core-settings'
import { useCurrency } from '@perawallet/wallet-core-currencies'
import {
    useAccountBalancesHistoryQuery,
    useAllAccounts,
    WalletAccount,
} from '@perawallet/wallet-core-accounts'

export type WealthTrendProps = {
    account?: WalletAccount
    period: HistoryPeriod
}

export const WealthTrend = ({ account, period }: WealthTrendProps) => {
    const styles = useStyles()
    const { preferredCurrency } = useCurrency()
    const { privacyMode } = useSettings()

    const accounts = useAllAccounts()
    const addresses = useMemo(
        () =>
            account
                ? [account.address]
                : accounts.map((a: WalletAccount) => a.address),
        [account, accounts],
    )

    const { data, isPending } = useAccountBalancesHistoryQuery(
        addresses,
        period,
    )

    const dataPoints = useMemo(
        () =>
            data?.map(p => {
                return p.fiatValue
            }) ?? [],
        [data],
    )

    const [absolute, percentage, isPositive] = useMemo(() => {
        const firstDp = dataPoints.at(0) ?? Decimal(0)
        const lastDp = dataPoints.at(-1) ?? Decimal(0)

        return [
            lastDp.minus(firstDp),
            lastDp.isZero()
                ? Decimal(0)
                : lastDp.minus(firstDp).div(lastDp).mul(100),
            lastDp.greaterThanOrEqualTo(firstDp),
        ]
    }, [dataPoints])

    return isPending || privacyMode ? (
        <></>
    ) : (
        <PWView style={styles.container}>
            <PWText
                style={isPositive ? styles.itemUp : styles.itemDown}
                variant='h4'
            >
                {isPositive ? '+' : '-'}
                {formatCurrency(
                    absolute,
                    2,
                    preferredCurrency,
                    undefined,
                    true,
                )}
            </PWText>
            <PWView style={styles.percentageContainer}>
                <PWIcon
                    name={isPositive ? 'arrow-up' : 'arrow-down'}
                    variant={isPositive ? 'helper' : 'error'}
                    size='sm'
                    style={
                        isPositive ? styles.trendIconUp : styles.trendIconDown
                    }
                />
                <PWText
                    style={isPositive ? styles.itemUp : styles.itemDown}
                    variant='h4'
                >
                    {percentage.toFixed(2)}%
                </PWText>
            </PWView>
        </PWView>
    )
}
