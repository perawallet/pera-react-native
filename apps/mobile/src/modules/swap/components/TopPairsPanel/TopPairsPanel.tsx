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
import { PWView } from '@components/core/PWView'
import { Text } from '@rneui/themed'
import { useCallback } from 'react'

import { SwapPair } from '@modules/swap/components/SwapPair/SwapPair'
import { CurrencyDisplay } from '@components/CurrencyDisplay'
import {
    ALGO_ASSET_ID,
    PeraAsset,
    useAssetsQuery,
} from '@perawallet/wallet-core-assets'
import Decimal from 'decimal.js'
import { FlashList } from '@shopify/flash-list'
import { useLanguage } from '@hooks/language'

type SwapRecord = {
    fromAsset?: PeraAsset
    toAsset?: PeraAsset
    volume: Decimal
}

//TODO this iz a mock implementation - implement properly
export const TopPairsPanel = () => {
    const themeStyle = useStyles()
    const { t } = useLanguage()

    const { data: assets } = useAssetsQuery([
        ALGO_ASSET_ID,
        '10458941',
        '700965019',
    ])

    const algoAsset = assets?.get(ALGO_ASSET_ID)
    const usdcAsset = assets?.get('10458941')
    const vestAsset = assets?.get('700965019')

    const renderSwapPair = useCallback(
        ({ item }: { item: SwapRecord }) => {
            if (!item.fromAsset || !item.toAsset) {
                return null
            }
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

    const pairs: SwapRecord[] = [
        {
            fromAsset: vestAsset,
            toAsset: algoAsset,
            volume: Decimal(20000),
        },
        {
            fromAsset: algoAsset,
            toAsset: usdcAsset,
            volume: Decimal(234240),
        },
        {
            fromAsset: algoAsset,
            toAsset: vestAsset,
            volume: Decimal(422210),
        },
    ]

    return (
        <PWView style={themeStyle.container}>
            <PWView style={themeStyle.headerContainer}>
                <Text h4>{t('swaps.top_pairs.title')}</Text>
                <Text
                    h4
                    h4Style={themeStyle.headerText}
                >
                    {t('swaps.top_pairs.volume')}
                </Text>
            </PWView>
            <FlashList
                style={themeStyle.scrollContainer}
                contentContainerStyle={themeStyle.itemScrollContainer}
                data={pairs}
                renderItem={renderSwapPair}
            />
        </PWView>
    )
}
