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
import type { ChainScope } from '@perawallet/wallet-core-chain-contract'
import { FIAT_DECIMAL_PLACES } from '@perawallet/wallet-core-currencies'
import {
    formatCurrency,
    resolveAssetDisplayPrecision,
    roundAssetAmountForDisplay,
    type Nullable,
    type Optional,
} from '@perawallet/wallet-core-shared'
import { useLanguage } from '@hooks/useLanguage'

type UseSwapAmountSectionParams = {
    scope: ChainScope
    variant: 'pay' | 'receive'
    assetId: string
    amount: Nullable<Decimal>
    onAmountChange?: (amount: Nullable<Decimal>) => void
    /** Called when the pay amount gains focus. */
    onAmountFocus?: () => void
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

// The field already holds this amount as the user typed it; reseeding would
// replace their text with a rounded copy.
const isTypedAmount = (text: string, amount: Decimal): boolean => {
    try {
        return new Decimal(text).equals(amount)
    } catch {
        return false
    }
}

const constrainDecimals = (text: string, maxDecimals: number): string => {
    const dotIndex = text.indexOf('.')
    if (dotIndex === -1) return text
    return text.slice(0, dotIndex + 1 + maxDecimals)
}

const formatAssetAmountForDisplay = (
    amount: Decimal,
    decimals: Optional<number>,
    locale: string,
): string => {
    if (decimals === undefined) {
        return formatCurrency(amount, 0, '', locale, false, 0)
    }
    const rounded = roundAssetAmountForDisplay(amount, decimals)
    return formatCurrency(
        rounded,
        resolveAssetDisplayPrecision(rounded, decimals),
        '',
        locale,
        false,
        0,
    )
}

export const useSwapAmountSection = ({
    scope,
    variant,
    assetId,
    amount,
    onAmountChange,
    onAmountFocus,
    isLocalCurrencyInput = false,
    fiatToAsset,
    assetToFiat,
}: UseSwapAmountSectionParams): UseSwapAmountSectionResult => {
    // Same cache entry as the section's AssetSelector, which may show an
    // asset the account doesn't hold.
    const { data: assets } = useAssetsQuery(scope, [assetId], {
        fetchMissing: true,
    })
    const asset = useMemo(() => assets?.get(assetId), [assets, assetId])
    // Passed explicitly rather than left to formatCurrency's getActiveLocale()
    // default so a mid-session language switch actually invalidates the memo.
    const { currentLanguage } = useLanguage()

    const isPay = variant === 'pay'
    const isFiatInput = isPay && isLocalCurrencyInput

    const [rawText, setRawText] = useState(amount ? amount.toString() : '')
    const [isFocused, setIsFocused] = useState(false)
    const lastTypedAssetRef = useRef<Nullable<Decimal>>(null)
    const typedTextRef = useRef<Nullable<string>>(null)
    const decimals = asset?.decimals

    useEffect(() => {
        if (amount === null) {
            setRawText('')
            lastTypedAssetRef.current = null
            typedTextRef.current = null
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
            const typed = typedTextRef.current
            if (typed !== null && isTypedAmount(typed, amount)) return
            typedTextRef.current = null
            setRawText(
                decimals === undefined
                    ? amount.toString()
                    : roundAssetAmountForDisplay(amount, decimals).toFixed(),
            )
        }
    }, [amount, isFocused, isFiatInput, assetToFiat, decimals])

    const displayValue = useMemo(() => {
        if (!isPay) {
            if (!amount) return ''
            return formatAssetAmountForDisplay(
                amount,
                asset?.decimals,
                currentLanguage,
            )
        }
        if (isFocused || !amount || isFiatInput) return rawText
        return formatAssetAmountForDisplay(
            amount,
            asset?.decimals,
            currentLanguage,
        )
    }, [isPay, isFiatInput, isFocused, rawText, amount, asset, currentLanguage])

    const hasPositiveAmount = amount !== null && amount.greaterThan(0)

    const handleFocus = useCallback(() => {
        if (isPay) {
            onAmountFocus?.()
        }
        setIsFocused(true)
    }, [isPay, onAmountFocus])
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
            typedTextRef.current = isFiatInput ? null : normalized

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
