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

import { useMemo } from 'react'
import type { AccountHoldingSource } from '@perawallet/wallet-core-accounts'
import type { ChainId } from '@perawallet/wallet-core-chain-contract'
import { chainDisplayNameOf } from '@perawallet/wallet-core-chain-shared'
import type { Nullable, Optional } from '@perawallet/wallet-core-shared'
import { useHoldingSourcesRefresh } from './useHoldingSourcesRefresh'

type UseNftRefreshFailureParams = {
    sources: readonly AccountHoldingSource[]
    unrefreshedChainIds: ReadonlySet<ChainId>
    selectedChainId: Nullable<ChainId>
    /** Rows on the picked network, already search-filtered. */
    networkRowCount: number
    isSearching: boolean
}

type UseNftRefreshFailureResult = {
    /** The picked networks whose last refresh failed, named; unset when none did. */
    failedChainNames: Optional<string>
    /** Nothing stored to show for them, so the list offers Retry instead of "No NFTs". */
    isLoadFailed: boolean
    /** Refreshes only the failed networks the gallery is showing. */
    handleRetry: () => void
    isRetrying: boolean
}

export const useNftRefreshFailure = ({
    sources,
    unrefreshedChainIds,
    selectedChainId,
    networkRowCount,
    isSearching,
}: UseNftRefreshFailureParams): UseNftRefreshFailureResult => {
    // On a chip only that network's failure counts; All names each failed one.
    const failedSources = useMemo(
        () =>
            sources.filter(
                ({ scope: { chainId } }) =>
                    unrefreshedChainIds.has(chainId) &&
                    (selectedChainId === null || chainId === selectedChainId),
            ),
        [sources, unrefreshedChainIds, selectedChainId],
    )
    const failedChainNames = useMemo(() => {
        const chainIds = new Set(
            failedSources.map(({ scope }) => scope.chainId),
        )
        return chainIds.size > 0
            ? [...chainIds]
                  .map(chainId => chainDisplayNameOf(chainId) ?? chainId)
                  .join(', ')
            : undefined
    }, [failedSources])
    const { isRefreshing: isRetrying, refresh: handleRetry } =
        useHoldingSourcesRefresh(failedSources)

    // A failed refresh keeps the stored NFTs, so the rows are stale, not gone;
    // with none stored it must not read as "no NFTs". A search that matches
    // nothing is not a failed load.
    return {
        failedChainNames,
        isLoadFailed:
            failedChainNames !== undefined &&
            networkRowCount === 0 &&
            !isSearching,
        handleRetry,
        isRetrying,
    }
}
