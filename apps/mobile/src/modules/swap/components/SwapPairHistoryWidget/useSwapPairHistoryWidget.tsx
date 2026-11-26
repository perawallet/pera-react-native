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

import { useCallback, useMemo, type ReactElement } from 'react'
import {
    useRecentSwapPairsQuery,
    scopeOfSwapAsset,
    useSwapAccountNames,
    useSwapSigningAccounts,
    useSwapsStore,
    type SwapHistoryPair,
} from '@perawallet/wallet-core-swaps'
import {
    toScopeKey,
    type ChainScope,
} from '@perawallet/wallet-core-chain-contract'
import { PWView } from '@components/core'
import { useBottomSheet } from '@modules/bottom-sheet'
import { SwapHistoryContent } from '@modules/swap/components/SwapHistoryContent'
import { trackEvent, SwapEvent, AnalyticsMetadataKey } from '@analytics'

import { SwapPairChip } from './SwapPairChip'
import { useStyles } from './styles'

export type UseSwapPairHistoryWidgetResult = {
    pairs: SwapHistoryPair[]
    isLoading: boolean
    isError: boolean
    isEnabled: boolean
    handlePairPress: (pair: SwapHistoryPair) => void
    handleSeeAllPress: () => void
    renderPair: (params: { item: SwapHistoryPair }) => ReactElement
    keyExtractor: (item: SwapHistoryPair) => string
    renderSeparator: () => ReactElement
}

export const useSwapPairHistoryWidget = (
    scope: ChainScope,
): UseSwapPairHistoryWidgetResult => {
    const setAccountPair = useSwapsStore(state => state.setAccountPair)
    // The same names and the same more-than-one rule as See all.
    const { names, isMultiAccount } = useSwapAccountNames(
        useSwapSigningAccounts(),
    )
    const nameById = useMemo(
        () => new Map(names.map(({ accountId, name }) => [accountId, name])),
        [names],
    )
    const { request: requestBottomSheet } = useBottomSheet()
    const styles = useStyles()

    const { pairs, isLoading, isError, isEnabled } = useRecentSwapPairsQuery()

    const handlePairPress = useCallback(
        (pair: SwapHistoryPair) => {
            trackEvent(SwapEvent.SelectHistory, {
                [AnalyticsMetadataKey.ChainId]: pair.assetIn.ref.chainId,
                [AnalyticsMetadataKey.SwapPairing]: `${pair.assetIn.unitName}/${pair.assetOut.unitName}`,
            })
            const fromScope = scopeOfSwapAsset(pair.assetIn.ref)
            const toScope = scopeOfSwapAsset(pair.assetOut.ref)
            setAccountPair({
                accountId: pair.accountId,
                chainId: pair.assetIn.ref.chainId,
                fromAsset: pair.assetIn.assetId,
                toAsset: pair.assetOut.assetId,
                toAssetScope:
                    toScopeKey(fromScope) === toScopeKey(toScope)
                        ? null
                        : toScope,
            })
        },
        [setAccountPair],
    )

    const handleSeeAllPress = useCallback(() => {
        trackEvent(SwapEvent.HistorySeeAll, {
            [AnalyticsMetadataKey.ChainId]: scope.chainId,
        })
        void requestBottomSheet<void>({
            contents: <SwapHistoryContent />,
            options: {
                size: 'modal',
                enablePanDownToClose: true,
                autoCreateContainer: false,
            },
        })
    }, [scope.chainId, requestBottomSheet])

    const renderPair = useCallback(
        ({ item }: { item: SwapHistoryPair }) => (
            <SwapPairChip
                assetIn={item.assetIn}
                assetOut={item.assetOut}
                accountName={
                    isMultiAccount ? nameById.get(item.accountId) : undefined
                }
                onPress={() => handlePairPress(item)}
            />
        ),
        [handlePairPress, nameById, isMultiAccount],
    )

    const keyExtractor = useCallback(
        (item: SwapHistoryPair) => item.pairKey,
        [],
    )

    const renderSeparator = useCallback(
        () => <PWView style={styles.separator} />,
        [styles.separator],
    )

    return {
        pairs,
        isLoading,
        isError,
        isEnabled,
        handlePairPress,
        handleSeeAllPress,
        renderPair,
        keyExtractor,
        renderSeparator,
    }
}
