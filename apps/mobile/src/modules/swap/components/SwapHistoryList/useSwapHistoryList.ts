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

import { useCallback, useMemo } from 'react'
import { useSelectedAccount } from '@perawallet/wallet-core-accounts'
import {
    toScopeKey,
    type ChainScope,
} from '@perawallet/wallet-core-chain-contract'
import { generateUniqueId } from '@perawallet/wallet-core-shared'
import {
    swapExplorerUrlFor,
    useSwapHistoryInfiniteQuery,
    type SwapAsset,
    type SwapHistoryItem,
} from '@perawallet/wallet-core-swaps'
import { trackEvent, SwapEvent, AnalyticsMetadataKey } from '@analytics'
import { useWebView } from '@modules/webview'

import { VISIBLE_SWAP_STATUSES } from '../../constants'
import { useSwapAccountAddresses } from '../../hooks/useSwapAccountAddresses'

/** A row the list can draw: rows naming an asset this wallet can't resolve are left out. */
export type ListedSwapHistoryItem = SwapHistoryItem & {
    assetIn: SwapAsset
    assetOut: SwapAsset
}

const isListable = (item: SwapHistoryItem): item is ListedSwapHistoryItem =>
    item.assetIn !== null && item.assetOut !== null

export type UseSwapHistoryListParams = {
    scope: ChainScope
    address: string
    onClose: () => void
}

export type UseSwapHistoryListResult = {
    swaps: ListedSwapHistoryItem[]
    isLoading: boolean
    isError: boolean
    isFetchingNextPage: boolean
    keyExtractor: (item: ListedSwapHistoryItem) => string
    handleItemPress: (item: ListedSwapHistoryItem) => void
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
    const accountAddresses = useSwapAccountAddresses(useSelectedAccount())

    // The request runs on the first entry's scope, so the swap scope leads.
    const accounts = useMemo(
        () => [
            { scope, address },
            ...accountAddresses.filter(
                entry => toScopeKey(entry.scope) !== toScopeKey(scope),
            ),
        ],
        [scope, address, accountAddresses],
    )

    const {
        swaps: loaded,
        isLoading,
        isError,
        isFetchingNextPage,
        hasNextPage,
        fetchNextPage,
    } = useSwapHistoryInfiniteQuery(accounts, VISIBLE_SWAP_STATUSES)
    const swaps = useMemo(() => loaded.filter(isListable), [loaded])

    const keyExtractor = useCallback(
        (item: ListedSwapHistoryItem) => item.orderId,
        [],
    )

    const handleItemPress = useCallback(
        (item: ListedSwapHistoryItem) => {
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
