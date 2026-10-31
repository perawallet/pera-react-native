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

import { useCallback, useMemo } from 'react'
import { Decimal } from 'decimal.js'
import {
    type AccountAssetBalanceHistoryItem,
    type AssetWithAccountBalance,
    useAccountAssetBalanceQuery,
    type WalletAccount,
} from '@perawallet/wallet-core-accounts'
import type { PeraAsset } from '@perawallet/wallet-core-assets'
import type { ChainScope } from '@perawallet/wallet-core-chain-contract'
import { usePreferences, useSettings } from '@perawallet/wallet-core-settings'
import type { HistoryPeriod, Nullable } from '@perawallet/wallet-core-shared'
import { usePreferredAmount } from '@components/PreferredAmount'
import { UserPreferences } from '@constants/user-preferences'
import { useCapability } from '@hooks/useCapability'
import { useChartInteraction } from '@hooks/useChartInteraction'
import { useClipboard } from '@hooks/useClipboard'
import { useLanguage } from '@hooks/useLanguage'

export type UseAssetHoldingsParams = {
    account: WalletAccount
    asset: PeraAsset
    scope: ChainScope
}

export type UseAssetHoldingsResult = {
    assetHolding: Nullable<AssetWithAccountBalance>
    /** Display units; 0 when the account doesn't hold the asset. */
    holdingAmount: Decimal
    /** Display units; the scrubbed point's amount while scrubbing, else the holding. */
    tokenAmount: Decimal
    /** False once the price lookup has settled with no rate: the header leads with the token amount instead. */
    isPriced: boolean
    hasBalanceHistory: boolean
    /** The chain has balance history and the global chart preference is on. */
    isChartShown: boolean
    period: HistoryPeriod
    /** The change line's period: the chart's while it's shown; with no chart there is none to follow, so the last 24 hours. */
    trendPeriod: HistoryPeriod
    setPeriod: (period: HistoryPeriod) => void
    selectedPoint: Nullable<AccountAssetBalanceHistoryItem>
    setSelectedPoint: (point: Nullable<AccountAssetBalanceHistoryItem>) => void
    canCopyAmount: boolean
    copyAmountHint: string
    handleCopyAmount: () => void
}

export const useAssetHoldings = ({
    account,
    asset,
    scope,
}: UseAssetHoldingsParams): UseAssetHoldingsResult => {
    const { copyToClipboard } = useClipboard()
    const { t } = useLanguage()
    const { privacyMode } = useSettings()
    const { period, setPeriod, selectedPoint, setSelectedPoint } =
        useChartInteraction<AccountAssetBalanceHistoryItem>()

    const hasBalanceHistory = useCapability({
        chain: { chainId: scope.chainId, capability: 'balanceHistory' },
    })
    const { getPreference } = usePreferences()
    const isChartShown =
        hasBalanceHistory && !!getPreference(UserPreferences.chartVisible)
    const trendPeriod = isChartShown ? period : 'one-day'

    const { data: assetHolding } = useAccountAssetBalanceQuery(
        account,
        asset.assetId,
        scope,
    )
    const holdingAmount = useMemo(
        () => assetHolding?.amount ?? new Decimal(0),
        [assetHolding],
    )
    const tokenAmount = selectedPoint?.amount ?? holdingAmount

    const { convertedValue, isPending } = usePreferredAmount(
        holdingAmount,
        asset.assetId,
        undefined,
        undefined,
        scope,
    )

    // The balance shows a rounded figure (6 dp at most), so a long-press copies the
    // full-precision amount. Privacy mode disables it: the copy would reveal the balance.
    const handleCopyAmount = useCallback(() => {
        if (privacyMode) return
        const fullAmount = tokenAmount.toFixed()
        const label = `${fullAmount} ${asset.unitName ?? ''}`.trim()
        void copyToClipboard(fullAmount, { body: label })
    }, [tokenAmount, asset.unitName, copyToClipboard, privacyMode])

    return {
        assetHolding,
        holdingAmount,
        tokenAmount,
        isPriced: isPending || convertedValue !== null,
        hasBalanceHistory,
        isChartShown,
        period,
        trendPeriod,
        setPeriod,
        selectedPoint,
        setSelectedPoint,
        canCopyAmount: !privacyMode,
        copyAmountHint: t('asset_details.copy_full_amount_hint'),
        handleCopyAmount,
    }
}
