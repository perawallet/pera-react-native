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

import { useCallback } from 'react'
import type { SwapHistoryItem } from '@perawallet/wallet-core-swaps'

export type UseSwapHistoryListParams = {
    swaps: SwapHistoryItem[]
    isLoading: boolean
    isError: boolean
    isFetchingNextPage: boolean
    hasNextPage: boolean
    onEndReached: () => void
}

export type UseSwapHistoryListResult = {
    keyExtractor: (item: SwapHistoryItem) => string
    handleEndReached: () => void
    shouldShowErrorState: boolean
    shouldShowEmptyState: boolean
}

export const useSwapHistoryList = ({
    swaps,
    isLoading,
    isError,
    isFetchingNextPage,
    hasNextPage,
    onEndReached,
}: UseSwapHistoryListParams): UseSwapHistoryListResult => {
    const keyExtractor = useCallback(
        (item: SwapHistoryItem) => item.idStr ?? String(item.id),
        [],
    )

    const handleEndReached = useCallback(() => {
        if (hasNextPage && !isFetchingNextPage) {
            onEndReached()
        }
    }, [hasNextPage, isFetchingNextPage, onEndReached])

    const shouldShowErrorState = isError && swaps.length === 0
    const shouldShowEmptyState = !isLoading && swaps.length === 0

    return {
        keyExtractor,
        handleEndReached,
        shouldShowErrorState,
        shouldShowEmptyState,
    }
}
