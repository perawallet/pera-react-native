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

import { useCallback, useMemo } from 'react'
import Decimal from 'decimal.js'
import { useTheme } from '@rneui/themed/dist/config/ThemeProvider'
import { useAssetsQuery, type PeraAsset } from '@perawallet/wallet-core-assets'

type UseSwapAmountSectionParams = {
    variant: 'pay' | 'receive'
    assetId: string | null
    amount: Decimal | null
    onAmountChange?: (amount: Decimal | null) => void
}

type UseSwapAmountSectionResult = {
    asset: PeraAsset | undefined
    isPay: boolean
    displayValue: string
    amountColor: string
    handleTextChange: (text: string) => void
}

export const useSwapAmountSection = ({
    variant,
    assetId,
    amount,
    onAmountChange,
}: UseSwapAmountSectionParams): UseSwapAmountSectionResult => {
    const { theme } = useTheme()

    const { data: assets } = useAssetsQuery(assetId ? [assetId] : [])
    const asset = useMemo(
        () => (assetId ? assets?.get(assetId) : undefined),
        [assets, assetId],
    )

    const isPay = variant === 'pay'

    const displayValue = useMemo(
        () => (amount ? amount.toString() : ''),
        [amount],
    )

    const hasPositiveAmount = amount !== null && amount.greaterThan(0)
    const amountColor = hasPositiveAmount
        ? theme.colors.textMain
        : theme.colors.textGrayLighter

    const handleTextChange = useCallback(
        (text: string) => {
            if (!isPay || !onAmountChange) return

            if (text === '') {
                onAmountChange(null)
                return
            }

            try {
                onAmountChange(new Decimal(text))
            } catch {
                // Ignore invalid decimal input
            }
        },
        [isPay, onAmountChange],
    )

    return {
        asset,
        isPay,
        displayValue,
        amountColor,
        handleTextChange,
    }
}
