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

import { useStyles } from './styles'
import { PWSkeleton, PWText, type PWTextProps, PWView } from '@components/core'
import { useMemo } from 'react'
import {
    formatCurrency,
    formatRawNumberInput,
    isAlgoAssetId,
    type Maybe,
    type Nullable,
} from '@perawallet/wallet-core-shared'
import type { Decimal } from 'decimal.js'
import { useSettings } from '@perawallet/wallet-core-settings'
import { useLanguage } from '@hooks/useLanguage'
import type { StyleProp, TextStyle } from 'react-native'
import {
    getVariantFontWeight,
    type FontWeight,
    type TypographyVariant,
} from '@theme/typography'
import { UNKNOWN_AMOUNT_PLACEHOLDER } from '@constants/ui'
import { resolvePrecision, type PrecisionVariant } from './precision'

const ALGO_SYMBOL = '¦'

/** U+00A6 Algo glyph is only patched in DMSans 400/500/700 — bump 600 → 700. */
export const getAlgoSymbolWeight = (
    variant: TypographyVariant,
    weight?: FontWeight,
): FontWeight => {
    const effective = weight ?? getVariantFontWeight(variant)
    return effective === 600 ? 700 : effective
}

/**
 * The precision policy is expressed semantically (see {@link PrecisionVariant}),
 * never as raw digit counts — that is the single door through which every
 * currency figure picks up its decimals. `assetDecimals` is only meaningful
 * for (and only accepted by) the `assetFull` variant.
 */
type PrecisionProps =
    | {
          precision: Exclude<PrecisionVariant, 'assetFull'>
          assetDecimals?: never
      }
    | { precision: 'assetFull'; assetDecimals?: number }

export type CurrencyAmountProps = {
    /**
     * The displayed unit. With a non-null `assetId` this is the on-chain unit
     * name — attacker-controlled, rendered as plain text only. With a null
     * `assetId` it is a trusted display-currency code from settings or a
     * first-party backend, and may map to a fiat symbol (USD → $).
     */
    currency: string
    /**
     * On-chain asset id when the amount is an asset amount ('0' for ALGO, ''
     * for an asset whose id is unknown), or null for a display-currency
     * amount. Currency identity — the native ALGO glyph, fiat-symbol mapping
     * — is decided by this id, never by `currency`: an ASA can name itself
     * "ALGO" or "USD". Chain-sourced unit names MUST come with their asset id;
     * trusted ALGO-ticker codes translate via `displayCurrencyToAssetId`.
     */
    assetId: Nullable<string>
    value: Maybe<Decimal>
    prefix?: string
    /**
     * A +/- (or similar) sign rendered between the asset symbol and the amount
     * — "¦ -0.5", "HIPO +1000". Unlike `prefix` (which sits before everything,
     * e.g. the "≈ " approximation marker), `sign` always follows the symbol so
     * signed amounts read consistently for ALGO and ASAs alike.
     */
    sign?: string
    alignRight?: boolean
    showSymbol?: boolean
    symbolPosition?: 'start' | 'end'
    isLoading?: boolean
    truncateToUnits?: boolean
    rawValue?: Nullable<string>
    ignorePrivacyMode?: boolean
    variant?: TypographyVariant
    style?: StyleProp<TextStyle>
} & PrecisionProps &
    Omit<PWTextProps, 'children' | 'variant'>

export const CurrencyAmount = (props: CurrencyAmountProps) => {
    const themeStyle = useStyles(props)
    const {
        currency,
        assetId,
        value,
        precision: precisionVariant,
        assetDecimals,
        alignRight: _alignRight,
        prefix,
        sign,
        truncateToUnits,
        showSymbol = true,
        symbolPosition = 'start',
        isLoading = false,
        rawValue,
        ignorePrivacyMode = false,
        variant = 'body',
        ...rest
    } = props

    const { precision, minPrecision } = resolvePrecision(
        precisionVariant,
        assetDecimals,
        value,
    )

    // Identity comes from the asset id alone; `currency` never earns the glyph.
    const isAssetMode = assetId != null
    const isAlgo = isAlgoAssetId(assetId)
    // Passed explicitly rather than left to formatCurrency's getActiveLocale()
    // default so a mid-session language switch actually invalidates the memo.
    const { currentLanguage } = useLanguage()
    const { privacyMode: privacyModeSetting } = useSettings()
    const privacyMode = privacyModeSetting && !ignorePrivacyMode

    // An asset amount's unit always renders as its own element: baking it into
    // the formatted string would route the on-chain unit name through
    // formatCurrency's fiat-symbol mapping (a "USD"-named ASA must never render
    // as "$"). A display-currency amount keeps the unit in the formatted string
    // — except with a `sign`, which must sit between the unit and the amount
    // ("HIPO +1000", not "+HIPO 1000").
    const showUnitSymbolStart =
        showSymbol &&
        symbolPosition === 'start' &&
        !isAlgo &&
        (isAssetMode || sign != null) &&
        !privacyMode
    const shouldShowSymbolInFormat =
        showSymbol &&
        symbolPosition === 'start' &&
        !showUnitSymbolStart &&
        !isAssetMode

    const algoSymbolWeight = getAlgoSymbolWeight(variant, props.weight)

    const displayValue = useMemo(() => {
        if (rawValue != null) {
            return privacyMode
                ? '****'
                : formatRawNumberInput(rawValue, currentLanguage)
        }

        if (value == null) {
            return UNKNOWN_AMOUNT_PLACEHOLDER
        }

        return privacyMode
            ? '****'
            : formatCurrency(
                  value,
                  precision,
                  currency,
                  currentLanguage,
                  shouldShowSymbolInFormat,
                  truncateToUnits,
                  minPrecision,
              )
    }, [
        value,
        precision,
        currency,
        shouldShowSymbolInFormat,
        truncateToUnits,
        minPrecision,
        privacyMode,
        rawValue,
        currentLanguage,
    ])

    const trailingSymbol = useMemo(() => {
        if (!showSymbol || symbolPosition !== 'end' || privacyMode) {
            return null
        }
        return isAlgo ? '' : ` ${currency}`
    }, [showSymbol, symbolPosition, privacyMode, isAlgo, currency])

    if (isLoading) {
        return (
            <PWView style={themeStyle.container}>
                <PWSkeleton style={themeStyle.skeleton} />
            </PWView>
        )
    }
    const showAlgoIcon = isAlgo && showSymbol && !privacyMode
    const showAlgoIconStart = showAlgoIcon && symbolPosition === 'start'
    const showAlgoIconEnd = showAlgoIcon && symbolPosition === 'end'

    return (
        <PWView style={themeStyle.container}>
            {showAlgoIconStart && (
                <PWText
                    variant={variant}
                    weight={algoSymbolWeight}
                    style={[themeStyle.symbol, props.style]}
                    accessibilityLabel='Algo'
                >
                    {ALGO_SYMBOL}
                </PWText>
            )}
            {showUnitSymbolStart && (
                <PWText
                    variant={variant}
                    style={[themeStyle.symbol, props.style]}
                >
                    {currency}
                </PWText>
            )}
            <PWView style={themeStyle.textContainer}>
                <PWText
                    variant={variant}
                    truncate
                    {...rest}
                >
                    {prefix ? prefix : ''}
                    {sign ? sign : ''}
                    {displayValue}
                    {trailingSymbol}
                </PWText>
            </PWView>
            {showAlgoIconEnd && (
                <PWText
                    variant={variant}
                    weight={algoSymbolWeight}
                    style={[themeStyle.symbol, props.style]}
                    accessibilityLabel='Algo'
                >
                    {ALGO_SYMBOL}
                </PWText>
            )}
        </PWView>
    )
}
