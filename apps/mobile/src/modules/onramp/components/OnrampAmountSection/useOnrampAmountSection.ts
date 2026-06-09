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
import { type Decimal } from 'decimal.js'
import { ZERO_DECIMAL, type Nullable } from '@perawallet/wallet-core-shared'
import { useCurrency } from '@perawallet/wallet-core-currencies'
import { ALGO_ASSET } from '@perawallet/wallet-core-assets'
import { parseRampAmount } from '@perawallet/wallet-core-onramp'

type UseOnrampAmountSectionParams = {
    variant: 'pay' | 'receive'
    /** Pay: the raw input string; receive: the quoted destination Decimal. */
    amount: string | Nullable<Decimal>
    onAmountChange?: (value: string) => void
}

type UseOnrampAmountSectionResult = {
    isPay: boolean
    /** Token-unit amount feeding the fiat row; zero when not computable. */
    fiatBaseAmount: Decimal
    /** ALGO-preferred users see fiat values in USD, like the rest of the app. */
    shouldUseUsdFallback: boolean
    handleTextChange: (text: string) => void
}

// Keep only digits and a single decimal separator — the decimal-pad keyboard
// still allows a second separator, and a paste can contain anything.
export const sanitizeAmountInput = (text: string): string => {
    const normalized = text.replace(/,/g, '.').replace(/[^0-9.]/g, '')
    const separatorIndex = normalized.indexOf('.')
    if (separatorIndex === -1) return normalized
    return (
        normalized.slice(0, separatorIndex + 1) +
        normalized.slice(separatorIndex + 1).replace(/\./g, '')
    )
}

// Token-unit amount for the fiat (preferred-currency) row. Empty, invalid, or
// non-positive input computes as zero so the row shows a "0.00" placeholder
// (matching the web AssetInput) instead of CurrencyDisplay's "---".
export const getFiatBaseAmount = (
    amount: string | Nullable<Decimal>,
): Decimal => {
    const parsed = typeof amount === 'string' ? parseRampAmount(amount) : amount
    return parsed?.greaterThan(0) ? parsed : ZERO_DECIMAL
}

// The form holds the source amount as a raw string (it is fed straight to the
// quote request), so this hook only sanitizes and forwards the string — no
// Decimal round-trip that would re-format mid-edit.
export const useOnrampAmountSection = ({
    variant,
    amount,
    onAmountChange,
}: UseOnrampAmountSectionParams): UseOnrampAmountSectionResult => {
    const isPay = variant === 'pay'

    const { preferredCurrency } = useCurrency()
    const shouldUseUsdFallback = preferredCurrency === ALGO_ASSET.unitName

    const fiatBaseAmount = useMemo(() => getFiatBaseAmount(amount), [amount])

    const handleTextChange = useCallback(
        (text: string) => {
            if (!isPay || !onAmountChange) return
            onAmountChange(sanitizeAmountInput(text))
        },
        [isPay, onAmountChange],
    )

    return { isPay, fiatBaseAmount, shouldUseUsdFallback, handleTextChange }
}
