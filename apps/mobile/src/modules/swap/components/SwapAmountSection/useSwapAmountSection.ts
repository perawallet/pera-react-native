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

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Decimal } from 'decimal.js'
import { useAssetsQuery, type PeraAsset } from '@perawallet/wallet-core-assets'
import { FIAT_DECIMAL_PLACES } from '@perawallet/wallet-core-currencies'
import {
    formatCurrency,
    type Nullable,
    type Optional,
} from '@perawallet/wallet-core-shared'
import { trackEvent, SwapEvent } from '@analytics'
import { useLanguage } from '@hooks/useLanguage'

type UseSwapAmountSectionParams = {
    variant: 'pay' | 'receive'
    assetId: string
    amount: Nullable<Decimal>
    onAmountChange?: (amount: Nullable<Decimal>) => void
    isLocalCurrencyInput?: boolean
    fiatToAsset?: (fiat: Nullable<Decimal>) => Nullable<Decimal>
    assetToFiat?: (asset: Nullable<Decimal>) => Nullable<Decimal>
}

type UseSwapAmountSectionResult = {
    asset: Optional<PeraAsset>
    isPay: boolean
    isFiatInput: boolean
    displayValue: string
    hasPositiveAmount: boolean
    handleTextChange: (text: string) => void
    handleFocus: () => void
    handleBlur: () => void
}

/**
 * Normalizes a user-typed amount into a dot-decimal string that `Decimal` can
 * parse. `decimal-pad` emits the device locale's decimal separator, so European
 * keyboards produce a comma, and pasted values may carry grouping separators.
 * The LAST separator is treated as the decimal point; every other separator
 * (comma, dot, or whitespace) is dropped as grouping. Non-numeric input is left
 * untouched so it still fails `Decimal` parsing downstream.
 */
const normalizeDecimalInput = (text: string): string => {
    const withoutSpaces = text.replace(/\s/g, '')
    const lastSeparator = Math.max(
        withoutSpaces.lastIndexOf('.'),
        withoutSpaces.lastIndexOf(','),
    )
    if (lastSeparator === -1) return withoutSpaces
    const integerPart = withoutSpaces
        .slice(0, lastSeparator)
        .replace(/[.,]/g, '')
    const fractionPart = withoutSpaces.slice(lastSeparator + 1)
    return `${integerPart}.${fractionPart}`
}

const constrainDecimals = (text: string, maxDecimals: number): string => {
    const dotIndex = text.indexOf('.')
    if (dotIndex === -1) return text
    return text.slice(0, dotIndex + 1 + maxDecimals)
}

export const useSwapAmountSection = ({
    variant,
    assetId,
    amount,
    onAmountChange,
    isLocalCurrencyInput = false,
    fiatToAsset,
    assetToFiat,
}: UseSwapAmountSectionParams): UseSwapAmountSectionResult => {
    const { data: assets } = useAssetsQuery([assetId])
    const asset = useMemo(() => assets?.get(assetId), [assets, assetId])
    // Passed explicitly rather than left to formatCurrency's getActiveLocale()
    // default so a mid-session language switch actually invalidates the memo.
    const { currentLanguage } = useLanguage()

    const isPay = variant === 'pay'
    const isFiatInput = isPay && isLocalCurrencyInput

    const [rawText, setRawText] = useState(amount ? amount.toString() : '')
    const [isFocused, setIsFocused] = useState(false)
    const lastTypedAssetRef = useRef<Nullable<Decimal>>(null)

    useEffect(() => {
        if (amount === null) {
            setRawText('')
            lastTypedAssetRef.current = null
            return
        }
        if (isFocused) return
        if (isFiatInput) {
            const isUserTyped =
                lastTypedAssetRef.current !== null &&
                amount.equals(lastTypedAssetRef.current)
            if (isUserTyped) return
            const fiat = assetToFiat?.(amount)
            setRawText(fiat ? fiat.toFixed(FIAT_DECIMAL_PLACES) : '')
        } else {
            setRawText(amount.toString())
        }
    }, [amount, isFocused, isFiatInput, assetToFiat])

    const displayValue = useMemo(() => {
        if (!isPay) {
            if (!amount) return ''
            return formatCurrency(
                amount,
                asset?.decimals ?? 0,
                asset?.unitName ?? '',
                currentLanguage,
                false,
                false,
                0,
            )
        }
        if (isFocused || !amount || isFiatInput) return rawText
        return formatCurrency(
            amount,
            asset?.decimals ?? 0,
            asset?.unitName ?? '',
            currentLanguage,
            false,
            false,
            0,
        )
    }, [isPay, isFiatInput, isFocused, rawText, amount, asset, currentLanguage])

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

            const normalized = isFiatInput
                ? constrainDecimals(
                      normalizeDecimalInput(text),
                      FIAT_DECIMAL_PLACES,
                  )
                : normalizeDecimalInput(text)
            setRawText(normalized)

            if (normalized === '' || normalized === '.') {
                onAmountChange(null)
                return
            }

            try {
                const typed = new Decimal(normalized)
                const next = isFiatInput
                    ? (fiatToAsset?.(typed) ?? null)
                    : typed
                if (isFiatInput) lastTypedAssetRef.current = next
                onAmountChange(next)
            } catch {
                // Ignore invalid input
            }
        },
        [isPay, onAmountChange, isFiatInput, fiatToAsset],
    )

    return {
        asset,
        isPay,
        isFiatInput,
        displayValue,
        hasPositiveAmount,
        handleTextChange,
        handleFocus,
        handleBlur,
    }
}
