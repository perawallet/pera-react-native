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
import type { Decimal } from 'decimal.js'
import { ZERO_DECIMAL, type Nullable } from '@perawallet/wallet-core-shared'
import { useCurrency } from '@perawallet/wallet-core-currencies'
import { ALGO_ASSET } from '@perawallet/wallet-core-assets'
import {
    DEFAULT_MAX_FRACTION_DIGITS,
    getMaxFractionDigits,
    parseCurrencyDecimalsConfig,
    parseRampAmount,
    type RampToken,
} from '@perawallet/wallet-core-onramp'
import {
    RemoteConfigKeys,
    useRemoteConfig,
} from '@perawallet/wallet-core-remote-config'
import { getCircleFlagUrl } from '@components/CircleFlag'

// Receive amounts fall back to this many fraction digits when the token does
// not declare its own.
const RECEIVE_FALLBACK_DECIMALS = 2

type UseOnrampAmountSectionParams = {
    variant: 'pay' | 'receive'
    token: Nullable<RampToken>
    /** Pay: the raw input string; receive: the quoted destination Decimal. */
    amount: string | Nullable<Decimal>
    /** Receive variant only: a quote is in flight. */
    isLoading?: boolean
    onAmountChange?: (value: string) => void
}

type UseOnrampAmountSectionResult = {
    isPay: boolean
    /** Value bound to the (pay-only) text input. */
    inputValue: string
    /** Formatted quoted amount for the receive row; '' when there is none. */
    receiveValue: string
    hasReceiveValue: boolean
    /** Resolved loading flag — only the receive variant can be loading. */
    isReceiveLoading: boolean
    /** FIAT tokens show their round country flag; crypto tokens their logo. */
    logoUrl: string | undefined
    /** Token-unit amount feeding the fiat row; zero when not computable. */
    fiatBaseAmount: Decimal
    /** ALGO-preferred users see fiat values in USD, like the rest of the app. */
    shouldUseUsdFallback: boolean
    handleTextChange: (text: string) => void
}

// Keep only digits and a single decimal separator — the decimal-pad keyboard
// still allows a second separator, and a paste can contain anything. The
// fraction is capped at `maxFractionDigits` (currency-aware); integer digits
// are untouched.
export const sanitizeAmountInput = (
    text: string,
    maxFractionDigits: number = DEFAULT_MAX_FRACTION_DIGITS,
): string => {
    const normalized = text.replace(/,/g, '.').replace(/[^0-9.]/g, '')
    const separatorIndex = normalized.indexOf('.')
    if (separatorIndex === -1) return normalized
    const integerPart = normalized.slice(0, separatorIndex)
    const fractionPart = normalized
        .slice(separatorIndex + 1)
        .replace(/\./g, '')
        .slice(0, maxFractionDigits)
    return `${integerPart}.${fractionPart}`
}

// Token-unit amount for the fiat (preferred-currency) row. Empty, invalid, or
// non-positive input computes as zero so the row shows a "0.00" placeholder
// (matching the web AssetInput) instead of CurrencyAmount's "---".
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
    token,
    amount,
    isLoading = false,
    onAmountChange,
}: UseOnrampAmountSectionParams): UseOnrampAmountSectionResult => {
    const isPay = variant === 'pay'

    const { preferredCurrency } = useCurrency()
    const shouldUseUsdFallback = preferredCurrency === ALGO_ASSET.unitName

    // Pay holds a raw string; receive holds a Decimal. Split them out once so
    // the input value and the formatted receive value are each well-typed.
    const inputValue = typeof amount === 'string' ? amount : ''
    const receiveAmount = typeof amount === 'string' ? null : (amount ?? null)

    const receiveValue = receiveAmount
        ? receiveAmount.toFixed(
              token?.fractionDecimals ?? RECEIVE_FALLBACK_DECIMALS,
          )
        : ''
    const hasReceiveValue = receiveValue !== ''

    const isReceiveLoading = !isPay && isLoading

    const logoUrl = token?.countryCode
        ? getCircleFlagUrl(token.countryCode)
        : (token?.logo ?? undefined)

    const fiatBaseAmount = useMemo(() => getFiatBaseAmount(amount), [amount])

    // Fraction-digit cap for the pay field, resolved from the source currency
    // and any remote-config overrides (fiat → 2, known crypto → its decimals,
    // unknown → 19). Read the raw string outside the memo since useRemoteConfig
    // returns a fresh wrapper each render.
    const remoteConfig = useRemoteConfig()
    const currencyDecimalsConfig = remoteConfig.getStringValue(
        RemoteConfigKeys.onramp_currency_decimals,
    )
    const maxFractionDigits = useMemo(
        () =>
            getMaxFractionDigits(
                token,
                parseCurrencyDecimalsConfig(currencyDecimalsConfig),
            ),
        [token, currencyDecimalsConfig],
    )

    const handleTextChange = useCallback(
        (text: string) => {
            if (!isPay || !onAmountChange) return
            onAmountChange(sanitizeAmountInput(text, maxFractionDigits))
        },
        [isPay, onAmountChange, maxFractionDigits],
    )

    return {
        isPay,
        inputValue,
        receiveValue,
        hasReceiveValue,
        isReceiveLoading,
        logoUrl,
        fiatBaseAmount,
        shouldUseUsdFallback,
        handleTextChange,
    }
}
