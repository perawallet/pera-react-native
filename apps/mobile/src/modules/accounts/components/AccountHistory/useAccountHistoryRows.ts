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
import {
    addressOn,
    useAccountHoldingSources,
    useAccountScope,
    useSelectedAccount,
    type AccountHoldingSource,
} from '@perawallet/wallet-core-accounts'
import {
    LEGACY_CHAIN_ID,
    type ChainId,
    type ChainScope,
} from '@perawallet/wallet-core-chain-contract'
import { chainDisplayNameOf } from '@perawallet/wallet-core-chain-shared'
import type { Nullable, Optional } from '@perawallet/wallet-core-shared'
import type { FilterOption } from '@components/FilterSelection'
import { useSyncRefresh } from '@hooks/useSyncRefresh'
import {
    useMergedTransactionHistoryRows,
    useTransactionHistoryRows,
    type HistoryFeedProps,
    type UseTransactionHistoryRowsResult,
} from '@modules/transactions'
import { useAccountChainFilterOptions } from '../../hooks/useAccountChainFilterOptions'
import { useAssetListViewStore } from '../../hooks/useAssetListViewStore'
import { useSelectedNetworkSource } from '../../hooks/useSelectedNetworkSource'

const NO_SOURCES: readonly AccountHoldingSource[] = []

export type UseAccountHistoryRowsParams = {
    /** `YYYY-MM-DD`, inclusive. */
    afterTime?: string
    /** `YYYY-MM-DD`, inclusive. */
    beforeTime?: string
}

export type UseAccountHistoryRowsResult = Omit<
    UseTransactionHistoryRowsResult,
    'fetchNextPage'
> & {
    /** The chip's network, or the account's own chain on All; on a merged history only analytics and CSV read it. */
    scope: ChainScope
    accountAddress: Optional<string>
    /** The network the history is narrowed to by the network chip; null is All. */
    networkChainId: Nullable<ChainId>
    /** All on an account with several networks: the rows interleave them and each names its own. */
    isMerged: boolean
    /** Empty when the account is on one network, so no chips show. */
    chainFilterOptions: FilterOption<Nullable<ChainId>>[]
    /** Shared with the Assets chips, so both tabs show the same network. */
    handleSelectChain: (chainId: Nullable<ChainId>) => void
    /** One per network on a merged history; mount a `TransactionHistoryFeed` for each. */
    historyFeeds: HistoryFeedProps[]
    /** Display names of the networks a merged history couldn't read, while the others' rows show. */
    failedNetworkNames: string[]
    handleLoadMore: () => void
    handleSearchOlder: () => void
    handleRefresh: () => void
    isRefreshing: boolean
    /** The network a row came from; the screen's own scope off a merged history. */
    scopeOf: (transactionId: string) => ChainScope
}

export const useAccountHistoryRows = ({
    afterTime,
    beforeTime,
}: UseAccountHistoryRowsParams): UseAccountHistoryRowsResult => {
    const account = useSelectedAccount()
    const ownScope = useAccountScope(account, LEGACY_CHAIN_ID)
    const sources = useAccountHoldingSources(account)
    const selectedSource = useSelectedNetworkSource(sources)
    const isMerged = selectedSource === null && sources.length > 1
    const scope = selectedSource?.scope ?? ownScope
    const ownAddress = account ? addressOn(account, ownScope) : undefined
    const accountAddress = selectedSource ? selectedSource.address : ownAddress
    const handleSelectChain = useAssetListViewStore(
        state => state.setSelectedChainId,
    )
    const chainFilterOptions = useAccountChainFilterOptions(
        sources,
        'history_network_filter',
    )

    // Both stay mounted so hook order never depends on the chip; the one not
    // in use reads nothing.
    const single = useTransactionHistoryRows({
        accountAddress: isMerged ? undefined : accountAddress,
        scope,
        afterTime,
        beforeTime,
    })
    const merged = useMergedTransactionHistoryRows({
        sources: isMerged ? sources : NO_SOURCES,
        afterTime,
        beforeTime,
    })
    const refreshAddresses = useMemo(
        () => (accountAddress && !isMerged ? [accountAddress] : []),
        [accountAddress, isMerged],
    )
    const singleRefresh = useSyncRefresh({ addresses: refreshAddresses, scope })

    const {
        hasNextPage,
        isFetchingNextPage,
        isSearchPaused,
        fetchNextPage,
        ...history
    } = isMerged ? merged : single

    // A paused search waits for Search Older, not for the list's end.
    const handleLoadMore = useCallback(() => {
        if (hasNextPage && !isFetchingNextPage && !isSearchPaused) {
            fetchNextPage()
        }
    }, [hasNextPage, isFetchingNextPage, isSearchPaused, fetchNextPage])

    const { scopeByTransactionId, failedChainIds } = merged
    const scopeOf = useCallback(
        (transactionId: string) =>
            (isMerged && scopeByTransactionId.get(transactionId)) || scope,
        [isMerged, scopeByTransactionId, scope],
    )
    // A failure with nothing to show is the full load-failed state instead.
    const failedNetworkNames = useMemo(
        () =>
            isMerged && !merged.isLoadFailed
                ? failedChainIds.map(
                      chainId => chainDisplayNameOf(chainId) ?? chainId,
                  )
                : [],
        [isMerged, merged.isLoadFailed, failedChainIds],
    )

    return {
        rows: history.rows,
        transactionCount: history.transactionCount,
        isLoading: history.isLoading,
        isFetched: history.isFetched,
        isFetchingNextPage,
        isError: history.isError,
        error: history.error,
        isLoadFailed: history.isLoadFailed,
        isLoadUnavailable: history.isLoadUnavailable,
        isLoadIntegrityBlocked: history.isLoadIntegrityBlocked,
        hasNextPage,
        isSearchPaused,
        retry: history.retry,
        isRetrying: history.isRetrying,
        suspectedPoisoningById: history.suspectedPoisoningById,
        scope,
        accountAddress,
        networkChainId: selectedSource?.scope.chainId ?? null,
        isMerged,
        chainFilterOptions,
        handleSelectChain,
        historyFeeds: merged.feeds,
        failedNetworkNames,
        handleLoadMore,
        handleSearchOlder: isMerged ? merged.searchOlder : fetchNextPage,
        handleRefresh: isMerged ? merged.refresh : singleRefresh.refresh,
        isRefreshing: isMerged
            ? merged.isRefreshing
            : singleRefresh.isRefreshing,
        scopeOf,
    }
}
