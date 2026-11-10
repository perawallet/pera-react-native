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
    abbreviateLargeAmount,
    DEFAULT_PRECISION,
    type AbbreviationUnit,
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
    resolveAmountFloor,
    resolvePrecision,
    type PrecisionVariant,
} from './precision'
import {
    i18nKey,
    type ChainId,
    type I18nKey,
} from '@perawallet/wallet-core-chain-contract'
import { nativeAssetGlyphOf } from '@modules/chain-ui/icon'

const ABBREVIATION_KEYS: Record<Exclude<AbbreviationUnit, ''>, I18nKey> = {
    K: i18nKey('common.amount_abbreviation.thousand'),
    M: i18nKey('common.amount_abbreviation.million'),
    B: i18nKey('common.amount_abbreviation.billion'),
    T: i18nKey('common.amount_abbreviation.trillion'),
}

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
              'assetFull' | 'significant' | 'compact' | 'list'
          >
          assetDecimals?: never
      }
    | {
          precision: 'assetFull' | 'significant' | 'compact' | 'list'
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
    /**
     * Defaults to after the amount for an asset ("1.23 ETH") and before it
     * for a display currency ("$ 1.23") or a native-coin glyph ("¦ 1.23").
     */
    symbolPosition?: 'start' | 'end'
    isLoading?: boolean
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
    /**
     * Shows an amount from a thousand or a million up scaled to that unit or a
     * larger one, with 2 decimals and the locale's unit (AOA 11.06T, AOA 11,06 Bn
     * in French), for a row whose width the amount must not take over. The
     * full figure belongs on the detail surface.
     */
    abbreviateFrom?: 'thousand' | 'million'
    /**
     * Truncates a leading unit instead of the amount when the row is too
     * narrow for both, for an asset whose unit has no length cap.
     */
    isUnitShrinkable?: boolean
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
        showSymbol = true,
        symbolPosition: symbolPositionProp,
        isLoading = false,
        rawValue,
        ignorePrivacyMode = false,
        variant = 'body',
        isInline = false,
        shouldFitWidth = false,
        abbreviateFrom,
        isUnitShrinkable = false,
        ...rest
    } = props

    // Identity comes from the asset id alone; `currency` never earns the glyph.
    const isAssetMode = assetId != null
    const amountFloor = resolveAmountFloor(precisionVariant, isFiat, value)
    // A floored amount is formatted as the floor itself, behind a bound marker.
    const flooredValue = amountFloor ?? value
    const { precision, minPrecision, rounding } = resolvePrecision(
        precisionVariant,
        assetDecimals,
        flooredValue,
        isFiat,
    )
    const roundedValue =
        rounding != null && flooredValue != null
            ? flooredValue.toDecimalPlaces(precision, rounding)
            : flooredValue
    const abbreviated =
        abbreviateFrom !== undefined && roundedValue != null
            ? abbreviateLargeAmount(roundedValue, DEFAULT_PRECISION, {
                  from: abbreviateFrom === 'thousand' ? 'K' : 'M',
                  rounding,
              })
            : undefined
    const abbreviationUnit = abbreviated?.unit ?? ''
    const shownValue = abbreviationUnit ? abbreviated?.amount : roundedValue
    const shownPrecision = abbreviationUnit ? DEFAULT_PRECISION : precision
    const shownMinPrecision = abbreviationUnit
        ? DEFAULT_PRECISION
        : minPrecision
    const nativeGlyph =
        chainId === null || assetId === null
            ? undefined
            : nativeAssetGlyphOf({ chainId, assetId })
    const symbolPosition =
        symbolPositionProp ??
        (isAssetMode && nativeGlyph === undefined ? 'end' : 'start')
    // Passed explicitly rather than left to formatCurrency's getActiveLocale()
    // default so a mid-session language switch actually invalidates the memo.
    const { t, currentLanguage } = useLanguage()
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
            shownPrecision,
            currency,
            currentLanguage,
            shouldShowSymbolInFormat,
            shownMinPrecision,
        )
        if (abbreviationUnit) {
            return t(ABBREVIATION_KEYS[abbreviationUnit], { amount: formatted })
        }
        if (!amountFloor) {
            return formatted
        }
        return `${amountFloor.isNegative() ? '> ' : '< '}${formatted}`
    }, [
        shownValue,
        amountFloor,
        shownPrecision,
        currency,
        shouldShowSymbolInFormat,
        shownMinPrecision,
        abbreviationUnit,
        t,
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
                    style={[
                        isUnitShrinkable ? themeStyle.unit : themeStyle.symbol,
                        props.style,
                    ]}
                    numberOfLines={isUnitShrinkable ? 1 : undefined}
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
