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
import {
    resolveFiatFloor,
    resolvePrecision,
    type PrecisionVariant,
} from './precision'
import type { ChainId } from '@perawallet/wallet-core-chain-contract'
import { nativeAssetGlyphOf } from '@modules/chain-ui/icon'

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
 * for (and only accepted by) the `assetFull`, `significant` and `compact`
 * variants.
 */
type PrecisionProps =
    | {
          precision: Exclude<
              PrecisionVariant,
              'assetFull' | 'significant' | 'compact'
          >
          assetDecimals?: never
      }
    | {
          precision: 'assetFull' | 'significant' | 'compact'
          assetDecimals?: number
      }

export type CurrencyAmountProps = {
    /**
     * The displayed unit. With a non-null `assetId` this is the on-chain unit
     * name — attacker-controlled, rendered as plain text only. With a null
     * `assetId` it is a trusted display-currency code from settings or a
     * first-party backend, and may map to a fiat symbol (USD → $).
     */
    currency: string
    /**
     * On-chain asset id when the amount is an asset amount (the chain's own
     * id for its native coin, '' for an asset whose id is unknown), or null for
     * a display-currency amount. Currency identity — the native-coin glyph,
     * fiat-symbol mapping — is decided by this id on `chainId`, never by
     * `currency`: an ASA can name itself "ALGO" or "USD". Chain-sourced unit
     * names MUST come with their asset id; trusted ALGO-ticker codes translate
     * via `displayCurrencyToAssetId`.
     */
    assetId: Nullable<string>
    /**
     * The chain `assetId` is on; null for a display-currency amount or one
     * with no single chain, which never draws a native-coin glyph.
     */
    chainId: Nullable<ChainId>
    value: Maybe<Decimal>
    /**
     * The amount is money in a fiat currency. Opt-in because a null `assetId`
     * doesn't imply it: a token the chain package can't resolve also has none.
     * A fiat amount shows at most 2 dp in `compact` and `preferredFull`
     * precision, and one under a cent as "< 0.01".
     */
    isFiat?: boolean
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
    /**
     * Renders text runs only, for nesting inside a parent `PWText` (e.g. a
     * `<Trans>` slot). A View nested in Text escapes the parent's truncation
     * and sits off the baseline on Android, so the parent owns truncation.
     */
    isInline?: boolean
    /**
     * Shrinks the whole figure, unit included, to fit one line rather than
     * cutting digits off with an ellipsis. Opt-in: Android re-measures fitted
     * text several times, too costly for list rows.
     */
    shouldFitWidth?: boolean
} & PrecisionProps &
    Omit<PWTextProps, 'children' | 'variant'>

export const CurrencyAmount = (props: CurrencyAmountProps) => {
    const themeStyle = useStyles(props)
    const {
        currency,
        assetId,
        chainId,
        value,
        isFiat = false,
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
        isInline = false,
        shouldFitWidth = false,
        ...rest
    } = props

    // Identity comes from the asset id alone; `currency` never earns the glyph.
    const isAssetMode = assetId != null
    const fiatFloor = resolveFiatFloor(precisionVariant, isFiat, value)
    // A floored amount is formatted as the floor itself, behind a bound marker.
    const flooredValue = fiatFloor ?? value
    const { precision, minPrecision, rounding } = resolvePrecision(
        precisionVariant,
        assetDecimals,
        flooredValue,
        isFiat,
    )
    const shownValue =
        rounding != null && flooredValue != null
            ? flooredValue.toDecimalPlaces(precision, rounding)
            : flooredValue
    const nativeGlyph =
        chainId === null || assetId === null
            ? undefined
            : nativeAssetGlyphOf({ chainId, assetId })
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
        nativeGlyph === undefined &&
        (isAssetMode || sign != null) &&
        !privacyMode
    const shouldShowSymbolInFormat =
        showSymbol &&
        symbolPosition === 'start' &&
        !showUnitSymbolStart &&
        !isAssetMode

    const nativeGlyphWeight = getAlgoSymbolWeight(variant, props.weight)

    const displayValue = useMemo(() => {
        if (rawValue != null) {
            return privacyMode
                ? '****'
                : formatRawNumberInput(rawValue, currentLanguage)
        }

        if (shownValue == null) {
            return UNKNOWN_AMOUNT_PLACEHOLDER
        }

        if (privacyMode) {
            return '****'
        }

        const formatted = formatCurrency(
            shownValue,
            precision,
            currency,
            currentLanguage,
            shouldShowSymbolInFormat,
            truncateToUnits,
            minPrecision,
        )
        if (!fiatFloor) {
            return formatted
        }
        return `${fiatFloor.isNegative() ? '> ' : '< '}${formatted}`
    }, [
        shownValue,
        fiatFloor,
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
        return nativeGlyph === undefined ? ` ${currency}` : ''
    }, [showSymbol, symbolPosition, privacyMode, nativeGlyph, currency])

    if (isLoading && isInline) {
        return (
            <PWText
                variant={variant}
                {...rest}
            >
                {UNKNOWN_AMOUNT_PLACEHOLDER}
            </PWText>
        )
    }
    if (isLoading) {
        return (
            <PWView style={themeStyle.container}>
                <PWSkeleton style={themeStyle.skeleton} />
            </PWView>
        )
    }
    const showNativeGlyph =
        nativeGlyph !== undefined && showSymbol && !privacyMode
    const showNativeGlyphStart = showNativeGlyph && symbolPosition === 'start'
    const showNativeGlyphEnd = showNativeGlyph && symbolPosition === 'end'

    // The spaces stand in for the container's gap between the parts. One
    // Text holds every part, so a parent's truncation or a fit-to-width
    // shrink applies to the unit and the figure alike.
    const amountRuns = (
        <>
            {showNativeGlyphStart && (
                <PWText
                    variant={variant}
                    weight={nativeGlyphWeight}
                    style={props.style}
                >
                    {`${nativeGlyph.glyph} `}
                </PWText>
            )}
            {showUnitSymbolStart && `${currency} `}
            {prefix ? prefix : ''}
            {sign ? sign : ''}
            {displayValue}
            {trailingSymbol}
            {showNativeGlyphEnd && (
                <PWText
                    variant={variant}
                    weight={nativeGlyphWeight}
                    style={props.style}
                >
                    {` ${nativeGlyph.glyph}`}
                </PWText>
            )}
        </>
    )

    if (isInline) {
        return (
            <PWText
                variant={variant}
                {...rest}
            >
                {amountRuns}
            </PWText>
        )
    }

    if (shouldFitWidth) {
        return (
            <PWView style={themeStyle.container}>
                <PWView style={themeStyle.textContainer}>
                    <PWText
                        variant={variant}
                        truncate
                        adjustsFontSizeToFit
                        {...rest}
                    >
                        {amountRuns}
                    </PWText>
                </PWView>
            </PWView>
        )
    }

    return (
        <PWView style={themeStyle.container}>
            {showNativeGlyphStart && (
                <PWText
                    variant={variant}
                    weight={nativeGlyphWeight}
                    style={[themeStyle.symbol, props.style]}
                    accessibilityLabel={nativeGlyph.label}
                >
                    {nativeGlyph.glyph}
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
            {showNativeGlyphEnd && (
                <PWText
                    variant={variant}
                    weight={nativeGlyphWeight}
                    style={[themeStyle.symbol, props.style]}
                    accessibilityLabel={nativeGlyph.label}
                >
                    {nativeGlyph.glyph}
                </PWText>
            )}
        </PWView>
    )
}
