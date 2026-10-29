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

import { useCallback } from 'react'
import type { ChainScope } from '@perawallet/wallet-core-chain-contract'
import { generateUniqueId } from '@perawallet/wallet-core-shared'
import {
    swapExplorerUrlFor,
    useSwapHistoryInfiniteQuery,
    type SwapHistoryItem,
} from '@perawallet/wallet-core-swaps'
import { trackEvent, SwapEvent, AnalyticsMetadataKey } from '@analytics'
import { useWebView } from '@modules/webview'

import { VISIBLE_SWAP_STATUSES } from '../../constants'

export type UseSwapHistoryListParams = {
    scope: ChainScope
    address: string
    onClose: () => void
}

export type UseSwapHistoryListResult = {
    swaps: SwapHistoryItem[]
    isLoading: boolean
    isError: boolean
    isFetchingNextPage: boolean
    keyExtractor: (item: SwapHistoryItem) => string
    handleItemPress: (item: SwapHistoryItem) => void
    handleEndReached: () => void
    shouldShowErrorState: boolean
    shouldShowEmptyState: boolean
}

export const useSwapHistoryList = ({
    scope,
    address,
    onClose,
}: UseSwapHistoryListParams): UseSwapHistoryListResult => {
    const { pushWebView } = useWebView()

    const {
        swaps,
        isLoading,
        isError,
        isFetchingNextPage,
        hasNextPage,
        fetchNextPage,
    } = useSwapHistoryInfiniteQuery(address, scope, VISIBLE_SWAP_STATUSES)

    const keyExtractor = useCallback(
        (item: SwapHistoryItem) => item.idStr ?? String(item.id),
        [],
    )

    const handleItemPress = useCallback(
        (item: SwapHistoryItem) => {
            const url = swapExplorerUrlFor(scope, item)
            if (!url) return
            trackEvent(SwapEvent.SelectHistoryInSeeAll, {
                [AnalyticsMetadataKey.ChainId]: scope.chainId,
                [AnalyticsMetadataKey.SwapPairing]: `${item.assetIn.unitName}/${item.assetOut.unitName}`,
            })
            onClose()
            // oxlint-disable-next-line pera/no-unvalidated-open-url -- swap adapter builds it from the chain's explorer config
            pushWebView({ url, id: generateUniqueId() })
        },
        [scope, onClose, pushWebView],
    )

    const handleEndReached = useCallback(() => {
        if (hasNextPage && !isFetchingNextPage) {
            fetchNextPage()
        }
    }, [hasNextPage, isFetchingNextPage, fetchNextPage])

    const shouldShowErrorState = isError && swaps.length === 0
    const shouldShowEmptyState = !isLoading && swaps.length === 0

    return {
        swaps,
        isLoading,
        isError,
        isFetchingNextPage,
        keyExtractor,
        handleItemPress,
        handleEndReached,
        shouldShowErrorState,
        shouldShowEmptyState,
    }
}
