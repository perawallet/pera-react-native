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
import PWView from '../../common/view/PWView'
import { FlatList } from 'react-native'
import { Text } from '@rneui/themed'
import { useCallback } from 'react'

import SwapPair from '../swap-pair/SwapPair'
import CurrencyDisplay from '../../currency/currency-display/CurrencyDisplay'
import { ALGO_ASSET_ID, useAssetsQuery } from '@perawallet/wallet-core-assets'

//TODO this iz a mock implementation - implement properly
const TopPairsPanel = () => {
    const themeStyle = useStyles()

    const { assets } = useAssetsQuery([ALGO_ASSET_ID, '10458941', '700965019'])

    const algoAsset = assets?.get(ALGO_ASSET_ID)
    const usdcAsset = assets?.get('10458941')
    const vestAsset = assets?.get('700965019')

    const renderSwapPair = useCallback(
        (item: any) => {
            return (
                <PWView style={themeStyle.itemRow}>
                    <SwapPair
                        style={themeStyle.itemContainer}
                        fromAsset={item.fromAsset}
                        toAsset={item.toAsset}
                    />
                    <CurrencyDisplay
                        currency='USD'
                        precision={2}
                        value={item.volume}
                        truncateToUnits
                        h4
                        h4Style={themeStyle.headerText}
                    />
                </PWView>
            )
        },
        [themeStyle],
    )

    const pairs = [
        {
            fromAsset: vestAsset,
            toAsset: algoAsset,
            volume: 20000,
        },
        {
            fromAsset: algoAsset,
            toAsset: usdcAsset,
            volume: 234240,
        },
        {
            fromAsset: algoAsset,
            toAsset: vestAsset,
            volume: 422210,
        },
    ]

    return (
        <PWView style={themeStyle.container}>
            <PWView style={themeStyle.headerContainer}>
                <Text h4>Top 5 Swaps</Text>
                <Text
                    h4
                    h4Style={themeStyle.headerText}
                >
                    Volume (24H)
                </Text>
            </PWView>
            <FlatList
                style={themeStyle.scrollContainer}
                contentContainerStyle={themeStyle.itemScrollContainer}
                data={pairs}
                renderItem={renderSwapPair}
            />
        </PWView>
    )
}

export default TopPairsPanel
