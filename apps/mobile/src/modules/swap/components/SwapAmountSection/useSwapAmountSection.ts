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

import { useCallback, useEffect, useMemo, useState } from 'react'
import { Decimal } from 'decimal.js'
import { useAssetsQuery, type PeraAsset } from '@perawallet/wallet-core-assets'
import {
    formatCurrency,
    type Nullable,
    type Optional,
} from '@perawallet/wallet-core-shared'
import { usePeraProvider } from '@perawallet/wallet-extension-provider'
import { trackEvent, SwapEvent } from '@analytics'

type UseSwapAmountSectionParams = {
    variant: 'pay' | 'receive'
    assetId: string
    amount: Nullable<Decimal>
    onAmountChange?: (amount: Nullable<Decimal>) => void
}

type UseSwapAmountSectionResult = {
    asset: Optional<PeraAsset>
    isPay: boolean
    displayValue: string
    hasPositiveAmount: boolean
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
        if (!isPay) {
            if (!amount) return ''
            return formatCurrency(
                amount,
                asset?.decimals ?? 0,
                asset?.unitName ?? '',
                deviceInfo.getDeviceLocale(),
                false,
                false,
                0,
            )
        }
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

    const handleFocus = useCallback(() => {
        if (isPay) {
            trackEvent(SwapEvent.EnterNumbers)
        }
        setIsFocused(true)
    }, [isPay])
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
        hasPositiveAmount,
        handleTextChange,
        handleFocus,
        handleBlur,
    }
}
