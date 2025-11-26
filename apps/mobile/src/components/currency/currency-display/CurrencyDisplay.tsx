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
import { Skeleton, Text, TextProps } from '@rneui/themed'
import PWView from '../../common/view/PWView'
import { useMemo } from 'react'
import {
    formatCurrency,
} from '@perawallet/wallet-core-shared'
import { Decimal } from 'decimal.js'
import AlgoIcon from '../../../../assets/icons/algo.svg'
import { useDeviceInfoService } from '@perawallet/wallet-core-platform-integration'
import { useSettings } from '@perawallet/wallet-core-settings'

export type CurrencyDisplayProps = {
    currency: string
    value: Decimal | null | undefined
    precision: number
    minPrecision?: number
    prefix?: string
    alignRight?: boolean
    showSymbol?: boolean
    skeleton?: boolean
    truncateToUnits?: boolean
} & TextProps

const CurrencyDisplay = (props: CurrencyDisplayProps) => {
    const themeStyle = useStyles(props)
    const deviceInfo = useDeviceInfoService()
    const {
        currency,
        value,
        precision,
        prefix,
        truncateToUnits,
        showSymbol = true,
        skeleton = false,
        minPrecision,
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

    if (skeleton) {
        return (
            <PWView style={themeStyle.container}>
                <Skeleton style={themeStyle.skeleton} />
            </PWView>
        )
    }
    return (
        <PWView style={themeStyle.container}>
            {isAlgo && showSymbol && (
                <AlgoIcon
                    style={[
                        themeStyle.algoIcon,
                        props.style,
                        props.h1Style,
                        props.h2Style,
                        props.h3Style,
                        props.h4Style,
                    ]}
                />
            )}
            <PWView style={themeStyle.textContainer}>
                <Text {...rest}>
                    {prefix ? prefix : ''}
                    {displayValue}
                </Text>
            </PWView>
        </PWView>
    )
}

export default CurrencyDisplay
