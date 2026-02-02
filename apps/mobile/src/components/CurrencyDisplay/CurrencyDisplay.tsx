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
import { StyleProp, TextStyle } from 'react-native'

export type CurrencyDisplayProps = {
    currency: string
    value: Decimal | null | undefined
    precision: number
    minPrecision?: number
    prefix?: string
    alignRight?: boolean
    showSymbol?: boolean
    isLoading?: boolean
    truncateToUnits?: boolean
    variant?: 'body' | 'h1' | 'h2' | 'h3' | 'h4' | 'caption'
    style?: StyleProp<TextStyle>
} & Omit<PWTextProps, 'children' | 'variant'>

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
        variant = 'body',
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
