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
import { useCallback, useState } from 'react'
import { Divider, Text, useTheme } from '@rneui/themed'
import Decimal from 'decimal.js'
import AssetSelection from '../../assets/asset-selection/AssetSelection'
import CurrencyDisplay from '../../currency/currency-display/CurrencyDisplay'
import PWView from '../../common/view/PWView'
import { View } from 'react-native'

import CurrencyInput from '../../currency/currency-input/CurrencyInput'
import { ALGO_ASSET_ID, PeraAsset, useAssetsQuery } from '@perawallet/wallet-core-assets'
import PWTouchableOpacity from '../../common/touchable-opacity/PWTouchableOpacity'
import PWIcon from '../../common/icons/PWIcon'

//TODO this iz a mock implementation - implement properly
const PairSelectionPanel = () => {
    const styles = useStyles()
    const { theme } = useTheme()

    const { assets } = useAssetsQuery(['10458941', '700965019'])

    const algoAsset = assets?.get(ALGO_ASSET_ID)
    const usdcAsset = assets?.get('700965019')

    const [sendAmount, setSendAmount] = useState('0.00')
    const [receiveAmount, _] = useState(Decimal(0))
    const [receiveAmountUSD, __] = useState(Decimal(0))
    const [fromBalance, ___] = useState(Decimal(0))
    const [toBalance, ____] = useState(Decimal(0))

    const handleAmountChange = useCallback(
        (formatted: string) => {
            setSendAmount(formatted)
        },
        [setSendAmount],
    )

    return (
        <PWView style={styles.container}>
            <PWView style={styles.fromContainer}>
                <PWView style={styles.titleRow}>
                    <Text style={styles.titleText}>You pay</Text>
                    <PWView style={styles.titleBalanceContainer}>
                        <Text style={styles.titleText}>Balance:</Text>
                        <CurrencyDisplay
                            style={styles.titleCurrency}
                            precision={2}
                            currency='ALGO'
                            value={fromBalance}
                        />
                    </PWView>
                </PWView>
                <PWView style={styles.inputContainer}>
                    <PWView style={styles.inputAmountsContainer}>
                        <CurrencyInput
                            cursorColor={theme.colors.textGray}
                            style={styles.primaryInput}
                            value={sendAmount}
                            minPrecision={2}
                            maxPrecision={18}
                            onChangeText={handleAmountChange}
                            affinityCalculationStrategy={0}
                        />
                        <CurrencyDisplay
                            style={styles.secondaryAmountText}
                            precision={2}
                            currency='USD'
                            value={receiveAmountUSD}
                        />
                    </PWView>
                    {algoAsset && <AssetSelection asset={algoAsset} />}
                </PWView>
            </PWView>
            <View style={styles.floatButtonContainer}>
                <PWTouchableOpacity style={styles.floatButton}>
                    <PWIcon
                        size='sm'
                        name='switch'
                    />
                </PWTouchableOpacity>
                <View style={styles.floatSplitButton}>
                    <PWTouchableOpacity style={styles.floatSplitButtonItem}>
                        <PWIcon
                            size='sm'
                            name='sliders'
                            variant='helper'
                        />
                    </PWTouchableOpacity>
                    <Divider
                        style={styles.floatSplitDivider}
                        orientation='vertical'
                    />
                    <PWTouchableOpacity style={styles.floatSplitButtonItem}>
                        <Text style={styles.floatButtonText}>MAX</Text>
                    </PWTouchableOpacity>
                </View>
            </View>
            <PWView style={styles.toContainer}>
                <PWView style={styles.titleRow}>
                    <Text style={styles.titleText}>You receive</Text>
                    <PWView style={styles.titleBalanceContainer}>
                        <Text style={styles.titleText}>Balance:</Text>
                        <CurrencyDisplay
                            style={styles.titleCurrency}
                            precision={2}
                            currency='ALGO'
                            value={toBalance}
                        />
                    </PWView>
                </PWView>
                <PWView style={styles.inputContainer}>
                    <PWView style={styles.inputAmountsContainer}>
                        <CurrencyDisplay
                            h2Style={styles.primaryAmountText}
                            showSymbol={false}
                            precision={2}
                            currency='ALGO'
                            h2
                            value={receiveAmount}
                        />
                        <CurrencyDisplay
                            style={styles.secondaryAmountText}
                            precision={2}
                            currency='USD'
                            value={receiveAmountUSD}
                        />
                    </PWView>
                    {usdcAsset && <AssetSelection asset={usdcAsset} />}
                </PWView>
            </PWView>
        </PWView>
    )
}

export default PairSelectionPanel
