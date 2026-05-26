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

import { useStyles } from './styles'
import { PWSkeleton, PWText, PWTextProps, PWView } from '@components/core'
import { useMemo } from 'react'
import {
    formatCurrency,
    formatRawNumberInput,
    type Maybe,
    type Nullable,
} from '@perawallet/wallet-core-shared'
import { Decimal } from 'decimal.js'
import { useSettings } from '@perawallet/wallet-core-settings'
import { StyleProp, TextStyle } from 'react-native'
import { usePeraProvider } from '@perawallet/wallet-extension-provider'
import {
    getVariantFontWeight,
    type FontWeight,
    type TypographyVariant,
} from '@theme/typography'

/**
 * Algo logo rendered as a text glyph. The bundled DMSans fonts map U+00A6 to
 * the Algo mark (the same custom fonts the native apps use), so showing it as
 * text scales with the font size and inherits color — no separate icon sizing
 * needed.
 */
const ALGO_SYMBOL = '¦'

/**
 * The Algo logo glyph (U+00A6) is only patched into DMSans weights 400/500/700.
 * DMSans-SemiBold (600) and the DMMono faces ship the stock two-bar `brokenbar`
 * glyph there instead, so the symbol must render in a patched DMSans weight:
 * weight 600 is bumped to 700, and passing any weight to {@link PWText} forces
 * the DMSans family (covering the `mono` variant). The amount text keeps its
 * own variant/weight — only the glyph is constrained.
 */
export const getAlgoSymbolWeight = (
    variant: TypographyVariant,
    weight?: FontWeight,
): FontWeight => {
    const effective = weight ?? getVariantFontWeight(variant)
    return effective === 600 ? 700 : effective
}

export type CurrencyDisplayProps = {
    currency: string
    value: Maybe<Decimal>
    precision: number
    minPrecision?: number
    prefix?: string
    alignRight?: boolean
    showSymbol?: boolean
    symbolPosition?: 'start' | 'end'
    isLoading?: boolean
    truncateToUnits?: boolean
    rawValue?: Nullable<string>
    ignorePrivacyMode?: boolean
    variant?: TypographyVariant
    style?: StyleProp<TextStyle>
} & Omit<PWTextProps, 'children' | 'variant'>

export const CurrencyDisplay = (props: CurrencyDisplayProps) => {
    const themeStyle = useStyles(props)
    const provider = usePeraProvider()
    const deviceInfo = provider.deviceInfo
    const {
        currency,
        value,
        precision,
        prefix,
        truncateToUnits,
        showSymbol = true,
        symbolPosition = 'start',
        isLoading = false,
        minPrecision,
        rawValue,
        ignorePrivacyMode = false,
        variant = 'body',
        ...rest
    } = props

    const isAlgo = useMemo(() => currency === 'ALGO', [currency])
    const { privacyMode: privacyModeSetting } = useSettings()
    const privacyMode = privacyModeSetting && !ignorePrivacyMode

    const shouldShowSymbolInFormat = showSymbol && symbolPosition === 'start'

    const algoSymbolWeight = getAlgoSymbolWeight(variant, props.weight)

    const displayValue = useMemo(() => {
        if (rawValue != null) {
            return privacyMode
                ? '****'
                : formatRawNumberInput(rawValue, deviceInfo.getDeviceLocale())
        }

        if (value == null) {
            return '---'
        }

        return privacyMode
            ? '****'
            : formatCurrency(
                  value,
                  precision,
                  currency,
                  deviceInfo.getDeviceLocale(),
                  shouldShowSymbolInFormat,
                  truncateToUnits,
                  minPrecision,
              )
    }, [
        value,
        precision,
        currency,
        deviceInfo,
        shouldShowSymbolInFormat,
        truncateToUnits,
        minPrecision,
        privacyMode,
        rawValue,
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
                >
                    {ALGO_SYMBOL}
                </PWText>
            )}
            <PWView style={themeStyle.textContainer}>
                <PWText
                    variant={variant}
                    truncate
                    {...rest}
                >
                    {prefix ? prefix : ''}
                    {displayValue}
                    {trailingSymbol}
                </PWText>
            </PWView>
            {showAlgoIconEnd && (
                <PWText
                    variant={variant}
                    weight={algoSymbolWeight}
                    style={[themeStyle.symbol, props.style]}
                >
                    {ALGO_SYMBOL}
                </PWText>
            )}
        </PWView>
    )
}
