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
import { useTheme } from '@rneui/themed'
import { PWSkeleton, PWText, PWTextProps, PWView } from '@components/core'
import { useMemo } from 'react'
import {
    formatCurrency,
    formatRawNumberInput,
    type Maybe,
    type Nullable,
} from '@perawallet/wallet-core-shared'
import { Decimal } from 'decimal.js'
import AlgoIcon from '@assets/icons/algo.svg'
import { useSettings } from '@perawallet/wallet-core-settings'
import { StyleProp, TextStyle } from 'react-native'
import { usePeraProvider } from '@perawallet/wallet-extension-provider'
import { TypographyVariant } from '@theme/typography'

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
    const { theme } = useTheme()
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
                <AlgoIcon
                    color={theme.colors.textMain}
                    style={[themeStyle.algoIcon, props.style]}
                />
            )}
            <PWView style={themeStyle.textContainer}>
                <PWText
                    variant={variant}
                    {...rest}
                >
                    {prefix ? prefix : ''}
                    {displayValue}
                    {trailingSymbol}
                </PWText>
            </PWView>
            {showAlgoIconEnd && (
                <AlgoIcon
                    color={theme.colors.textMain}
                    style={[themeStyle.algoIcon, props.style]}
                />
            )}
        </PWView>
    )
}
