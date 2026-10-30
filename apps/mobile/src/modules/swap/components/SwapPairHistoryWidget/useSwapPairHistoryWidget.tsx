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

import { useCallback, type ReactElement } from 'react'
import {
    useDistinctPairsHistoryQuery,
    useSwaps,
    type SwapDistinctPairItem,
} from '@perawallet/wallet-core-swaps'
import { addressOn, useSelectedAccount } from '@perawallet/wallet-core-accounts'
import type { ChainScope } from '@perawallet/wallet-core-chain-contract'
import { PWView } from '@components/core'
import { useBottomSheet } from '@modules/bottom-sheet'
import { SwapHistoryContent } from '@modules/swap/components/SwapHistoryContent'
import { trackEvent, SwapEvent, AnalyticsMetadataKey } from '@analytics'

import { VISIBLE_SWAP_STATUSES } from '../../constants'
import { SwapPairChip } from './SwapPairChip'
import { useStyles } from './styles'

export type UseSwapPairHistoryWidgetResult = {
    pairs: SwapDistinctPairItem[]
    isLoading: boolean
    isError: boolean
    isEnabled: boolean
    address: string
    handlePairPress: (pair: SwapDistinctPairItem) => void
    handleSeeAllPress: () => void
    renderPair: (params: { item: SwapDistinctPairItem }) => ReactElement
    keyExtractor: (item: SwapDistinctPairItem) => string
    renderSeparator: () => ReactElement
}

export const useSwapPairHistoryWidget = (
    scope: ChainScope,
): UseSwapPairHistoryWidgetResult => {
    const selectedAccount = useSelectedAccount()
    const { setFromAsset, setToAsset } = useSwaps(scope)
    const address = selectedAccount
        ? (addressOn(selectedAccount, scope) ?? '')
        : ''
    const { request: requestBottomSheet } = useBottomSheet()
    const styles = useStyles()

    const { data, isLoading, isError } = useDistinctPairsHistoryQuery(
        address,
        scope,
        VISIBLE_SWAP_STATUSES,
        address.length > 0,
    )

    const handlePairPress = useCallback(
        (pair: SwapDistinctPairItem) => {
            trackEvent(SwapEvent.SelectHistory, {
                [AnalyticsMetadataKey.ChainId]: scope.chainId,
                [AnalyticsMetadataKey.SwapPairing]: `${pair.assetIn.unitName}/${pair.assetOut.unitName}`,
            })
            setFromAsset(String(pair.assetIn.assetId))
            setToAsset(String(pair.assetOut.assetId))
        },
        [scope.chainId, setFromAsset, setToAsset],
    )

    const handleSeeAllPress = useCallback(() => {
        if (!address) return
        trackEvent(SwapEvent.HistorySeeAll, {
            [AnalyticsMetadataKey.ChainId]: scope.chainId,
        })
        void requestBottomSheet<void>({
            contents: (
                <SwapHistoryContent
                    scope={scope}
                    address={address}
                />
            ),
            options: {
                size: 'modal',
                enablePanDownToClose: true,
                autoCreateContainer: false,
            },
        })
    }, [address, scope, requestBottomSheet])

    const renderPair = useCallback(
        ({ item }: { item: SwapDistinctPairItem }) => (
            <SwapPairChip
                assetIn={item.assetIn}
                assetOut={item.assetOut}
                chainId={scope.chainId}
                onPress={() => handlePairPress(item)}
            />
        ),
        [handlePairPress, scope.chainId],
    )

    const keyExtractor = useCallback(
        (item: SwapDistinctPairItem) => item.pairKey,
        [],
    )

    const renderSeparator = useCallback(
        () => <PWView style={styles.separator} />,
        [styles.separator],
    )

    return {
        pairs: data ?? [],
        isLoading,
        isError,
        isEnabled: address.length > 0,
        address,
        handlePairPress,
        handleSeeAllPress,
        renderPair,
        keyExtractor,
        renderSeparator,
    }
}
