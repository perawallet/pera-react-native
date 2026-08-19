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

import { PWView } from '@components/core'
import { useStyles } from './styles'
import {
    ALGO_ASSET_ID,
    type HistoryPeriod,
} from '@perawallet/wallet-core-shared'
import { percentChange } from '@perawallet/wallet-core-blockchain'
import { useMemo } from 'react'
import { Decimal } from 'decimal.js'
import { useSettings } from '@perawallet/wallet-core-settings'
import {
    useAccountBalancesHistoryQuery,
    useAllAccounts,
    type WalletAccount,
} from '@perawallet/wallet-core-accounts'
import { PreferredAmount } from '@components/PreferredAmount'
import { TrendIndicator } from '@components/TrendIndicator'

export type WealthTrendProps = {
    account?: WalletAccount
    period: HistoryPeriod
    /** Gate the (slow) history fetch on chart visibility. */
    enabled?: boolean
}

export const WealthTrend = ({
    account,
    period,
    enabled = true,
}: WealthTrendProps) => {
    const styles = useStyles()
    const { privacyMode } = useSettings()

    const accounts = useAllAccounts()
    const addresses = useMemo(
        () =>
            account
                ? [account.address]
                : accounts.map((a: WalletAccount) => a.address),
        [account, accounts],
    )

    const { data, isPending, isUnavailableOnNetwork } =
        useAccountBalancesHistoryQuery(addresses, period, enabled)

    const dataPoints = useMemo(
        () =>
            data?.map(p => ({
                value: p.preferredValue,
                algoValue: p.algoValue,
                datetime: p.datetime,
            })) ?? [],
        [data],
    )

    const [absolute, percentage, isPositive] = useMemo(() => {
        const firstDp = dataPoints.at(0)?.algoValue ?? new Decimal(0)
        const lastDp = dataPoints.at(-1)?.algoValue ?? new Decimal(0)

        return [
            lastDp.minus(firstDp),
            percentChange(firstDp, lastDp),
            lastDp.greaterThanOrEqualTo(firstDp),
        ]
    }, [dataPoints])

    return isPending || privacyMode || isUnavailableOnNetwork ? (
        <></>
    ) : (
        <PWView style={styles.container}>
            <PreferredAmount
                sourceAmount={absolute}
                sourceAssetId={ALGO_ASSET_ID}
                density='compact'
                showSymbol
                style={isPositive ? styles.itemUp : styles.itemDown}
            />
            <TrendIndicator
                percentage={percentage}
                hasIconBackground
                shouldHideIconWhenZero
            />
        </PWView>
    )
}
