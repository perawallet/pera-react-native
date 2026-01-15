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
import { PWTouchableOpacity, PWView } from '@components/core'
import { ScrollView } from 'react-native'
import { Text } from '@rneui/themed'
import { useCallback } from 'react'

import { SwapPair } from '@modules/swap/components/SwapPair/SwapPair'
import {
    ALGO_ASSET_ID,
    PeraAsset,
    useAssetsQuery,
} from '@perawallet/wallet-core-assets'
import { useLanguage } from '@hooks/language'

type SwapAssets = {
    fromAsset?: PeraAsset
    toAsset?: PeraAsset
}

export const SwapHistoryPanel = () => {
    const themeStyle = useStyles()
    const { t } = useLanguage()

    const { data: assets } = useAssetsQuery(['11711', '10458941', '700965019'])

    const algoAsset = assets?.get(ALGO_ASSET_ID)
    const usdcAsset = assets?.get('700965019')
    const vestAsset = assets?.get('11711')

    const renderSwapPair = useCallback(
        (item: SwapAssets, index: number) => {
            if (!item.fromAsset || !item.toAsset) {
                return null
            }
            return (
                <SwapPair
                    key={'swappair' + index}
                    style={themeStyle.itemContainer}
                    fromAsset={item.fromAsset}
                    toAsset={item.toAsset}
                />
            )
        },
        [themeStyle.itemContainer],
    )

    const pairs: SwapAssets[] = [
        {
            fromAsset: vestAsset,
            toAsset: algoAsset,
        },
        {
            fromAsset: algoAsset,
            toAsset: usdcAsset,
        },
        {
            fromAsset: algoAsset,
            toAsset: vestAsset,
        },
    ]

    return (
        <PWView style={themeStyle.container}>
            <PWView style={themeStyle.headerContainer}>
                <Text h4>{t('swaps.history.title')}</Text>
                <PWTouchableOpacity>
                    <Text
                        h4
                        h4Style={themeStyle.headerText}
                    >
                        {t('swaps.history.see_all')}
                    </Text>
                </PWTouchableOpacity>
            </PWView>
            <ScrollView
                contentContainerStyle={themeStyle.itemScrollContainer}
                horizontal={true}
            >
                {pairs.map((item, i) => {
                    return renderSwapPair(item, i)
                })}
            </ScrollView>
        </PWView>
    )
}
