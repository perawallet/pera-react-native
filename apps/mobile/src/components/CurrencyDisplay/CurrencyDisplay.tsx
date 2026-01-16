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
import { formatCurrency } from '@perawallet/wallet-core-shared'
import { Decimal } from 'decimal.js'
import AlgoIcon from '@assets/icons/algo.svg'
import { useDeviceInfoService } from '@perawallet/wallet-core-platform-integration'
import { useSettings } from '@perawallet/wallet-core-settings'

/**
 * Props for the CurrencyDisplay component.
 */
export type CurrencyDisplayProps = {
    /** Currency code (e.g., "USD", "ALGO") */
    currency: string
    /** Numeric value to display */
    value: Decimal | null | undefined
    /** Maximum number of decimal places to show */
    precision: number
    /** Minimum number of decimal places to show */
    minPrecision?: number
    /** Text string to prepend to the formatted value */
    prefix?: string
    /** Whether to right-align the content */
    alignRight?: boolean
    /** Whether to show the currency symbol or ticker */
    showSymbol?: boolean
    /** Whether to show a skeleton loader instead of the value */
    isLoading?: boolean
    /** Whether to use unit suffixes (K, M, B, T) for large values */
    truncateToUnits?: boolean
    /** Use h1 typography variant */
    h1?: boolean
    /** Use h2 typography variant */
    h2?: boolean
    /** Use h3 typography variant */
    h3?: boolean
    /** Use h4 typography variant */
    h4?: boolean
} & Omit<PWTextProps, 'children' | 'variant'>

/**
 * A comprehensive component for displaying formatted currency values.
 * Supports privacy mode (masking values), skeleton loaders, and localized formatting.
 *
 * @example
 * <CurrencyDisplay
 *   currency="ALGO"
 *   value={new Decimal(100)}
 *   precision={6}
 *   h2
 * />
 */
export const CurrencyDisplay = (props: CurrencyDisplayProps) => {
    const themeStyle = useStyles(props)
    const { theme } = useTheme()
    const deviceInfo = useDeviceInfoService()
    const {
        currency,
        value,
        precision,
        prefix,
        truncateToUnits,
        showSymbol = true,
        isLoading = false,
        minPrecision,
        h1,
        h2,
        h3,
        h4,
        ...rest
    } = props

    const isAlgo = useMemo(() => currency === 'ALGO', [currency])
    const { privacyMode } = useSettings()

    const displayValue = useMemo(() => {
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
                  showSymbol,
                  truncateToUnits,
                  minPrecision,
              )
    }, [
        value,
        precision,
        currency,
        deviceInfo,
        showSymbol,
        truncateToUnits,
        minPrecision,
        privacyMode,
    ])

    const variant = h1 ? 'h1' : h2 ? 'h2' : h3 ? 'h3' : h4 ? 'h4' : 'body'

    if (isLoading) {
        return (
            <PWView style={themeStyle.container}>
                <PWSkeleton style={themeStyle.skeleton} />
            </PWView>
        )
    }
    return (
        <PWView style={themeStyle.container}>
            {isAlgo && showSymbol && (
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
                </PWText>
            </PWView>
        </PWView>
    )
}
