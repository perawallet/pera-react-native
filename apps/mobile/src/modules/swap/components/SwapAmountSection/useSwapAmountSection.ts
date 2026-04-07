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

import { useCallback, useEffect, useMemo, useState } from 'react'
import { Decimal } from 'decimal.js'
import { useTheme } from '@rneui/themed/dist/config/ThemeProvider'
import { useAssetsQuery, type PeraAsset } from '@perawallet/wallet-core-assets'
import { formatCurrency } from '@perawallet/wallet-core-shared'
import { usePeraProvider } from '@perawallet/wallet-extension-provider'

type UseSwapAmountSectionParams = {
    variant: 'pay' | 'receive'
    assetId: string
    amount: Decimal | null
    onAmountChange?: (amount: Decimal | null) => void
}

type UseSwapAmountSectionResult = {
    asset: PeraAsset | undefined
    isPay: boolean
    displayValue: string
    amountColor: string
    handleTextChange: (text: string) => void
    handleFocus: () => void
    handleBlur: () => void
}

export const useSwapAmountSection = ({
    variant,
    assetId,
    amount,
    onAmountChange,
}: UseSwapAmountSectionParams): UseSwapAmountSectionResult => {
    const { theme } = useTheme()
    const provider = usePeraProvider()
    const deviceInfo = provider.deviceInfo

    const { data: assets } = useAssetsQuery([assetId])
    const asset = useMemo(() => assets?.get(assetId), [assets, assetId])

    const isPay = variant === 'pay'

    const [rawText, setRawText] = useState(amount ? amount.toString() : '')
    const [isFocused, setIsFocused] = useState(false)

    useEffect(() => {
        if (amount === null) {
            setRawText('')
        } else if (!isFocused) {
            setRawText(amount.toString())
        }
    }, [amount, isFocused])

    const displayValue = useMemo(() => {
        if (!isPay) return amount ? amount.toString() : ''
        if (isFocused || !amount) return rawText
        return formatCurrency(
            amount,
            asset?.decimals ?? 0,
            asset?.unitName ?? '',
            deviceInfo.getDeviceLocale(),
            false,
            false,
            0,
        )
    }, [isPay, isFocused, rawText, amount, asset, deviceInfo])

    const hasPositiveAmount = amount !== null && amount.greaterThan(0)
    const amountColor = hasPositiveAmount
        ? theme.colors.textMain
        : theme.colors.textGrayLighter

    const handleFocus = useCallback(() => setIsFocused(true), [])
    const handleBlur = useCallback(() => setIsFocused(false), [])

    const handleTextChange = useCallback(
        (text: string) => {
            if (!isPay || !onAmountChange) return

            const normalized = text.replace(',', '.')
            setRawText(normalized)

            if (normalized === '' || normalized === '.') {
                onAmountChange(null)
                return
            }

            try {
                onAmountChange(new Decimal(normalized))
            } catch {
                // Ignore invalid input
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
        handleFocus,
        handleBlur,
    }
}
