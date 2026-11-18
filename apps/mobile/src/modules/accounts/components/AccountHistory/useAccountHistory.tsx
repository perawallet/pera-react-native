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
import { useNavigation } from '@react-navigation/native'
import type { NativeStackNavigationProp } from '@react-navigation/native-stack'
import type { ChainId } from '@perawallet/wallet-core-chain-contract'
import { chainDisplayNameOf } from '@perawallet/wallet-core-chain-shared'
import {
    historyItemGroupToOpen,
    type SuspectedPoisoning,
    type TransactionHistoryItem,
} from '@perawallet/wallet-core-transactions'
import type { Nullable } from '@perawallet/wallet-core-shared'
import type { FilterOption } from '@components/FilterSelection'
import { PWLoadingIndicator, PWView } from '@components/core'
import { useLanguage } from '@hooks/useLanguage'
import { useNetworkStatus } from '@modules/network'
import {
    TransactionHistoryRow,
    TransactionHistorySearchOlder,
    type HistoryFeedProps,
    type TransactionListRow,
} from '@modules/transactions'
import type { AppStackParamList } from '@routes/types'
import type {
    CustomDateRange,
    TransactionFilter,
} from '../TransactionsFilterContent'
import { useStyles } from './styles'
import { useAccountHistoryCsvExport } from './useAccountHistoryCsvExport'
import { useAccountHistoryFilter } from './useAccountHistoryFilter'
import { useAccountHistoryRows } from './useAccountHistoryRows'

export type UseAccountHistoryResult = {
    rows: TransactionListRow[]
    isLoading: boolean
    /** Whether to render the cold-start skeleton (no read has resolved yet) */
    isInitialLoad: boolean
    /** Nothing loaded and the read failed: a retry state, not the skeleton. */
    isLoadFailed: boolean
    /** The failure is a Pera service this network doesn't have, so retrying can't help. */
    isLoadUnavailable: boolean
    isLoadIntegrityBlocked: boolean
    isLoadOffline: boolean
    /** Re-requests the page that failed. */
    handleRetry: () => void
    isRetrying: boolean
    /** The automatic search stopped after a run of empty pages, rows loaded or not; see `handleSearchOlder`. */
    isSearchPaused: boolean
    handleSearchOlder: () => void
    isFetchingNextPage: boolean
    isError: boolean
    error: Nullable<Error>
    hasNextPage: boolean
    handleLoadMore: () => void
    handleRefresh: () => void
    /** Renders one transaction row for the list. */
    renderItem: (params: { item: TransactionListRow }) => ReactElement
    /** Renders the list footer: the spinner, the search-older action, or nothing. */
    renderFooter: () => Nullable<ReactElement>
    /** Opens the filter sheet. */
    handleFilterPress: () => void
    isRefreshing: boolean
    isEmpty: boolean
    /** The network the history is narrowed to by the network chip; null is All. */
    networkChainId: Nullable<ChainId>
    /** Empty when the account is on one network, so no chips show. */
    chainFilterOptions: FilterOption<Nullable<ChainId>>[]
    /** Shared with the Assets chips, so both tabs show the same network. */
    handleSelectChain: (chainId: Nullable<ChainId>) => void
    /** All on an account with several networks: the rows interleave them and each names its own. */
    isMerged: boolean
    /** One per network on a merged history; mount a `TransactionHistoryFeed` for each. */
    historyFeeds: HistoryFeedProps[]
    /** Networks that couldn't be read while rows show; retried by `handleRetry`. */
    failedNetworkNames: string[]
    /** Networks without a history service: named apart from failures, with no retry. */
    unavailableNetworkNames: string[]
    /** What an empty history says, naming the network when narrowed to one. */
    emptyBody: string
    /**
     * Empty *because* nothing is cached and we're offline, rather than because
     * the account has no transactions. The history query reads SQLite with
     * `networkMode: 'always'`, so it never reports `isPaused` — connectivity
     * has to come from the network store instead.
     */
    isOfflineEmpty: boolean
    handleExportCsv: () => void
    isExportingCsv: boolean
    isCsvExportVisible: boolean
    activeFilter: TransactionFilter
    customRange?: CustomDateRange
    handleOpenFilter: () => Promise<void>
    handleTransactionPress: (transaction: TransactionHistoryItem) => void
    /** Keyed by transaction id. */
    suspectedPoisoningById: ReadonlyMap<string, SuspectedPoisoning>
}

export const useAccountHistory = (): UseAccountHistoryResult => {
    const { hasInternet } = useNetworkStatus()
    const navigation =
        useNavigation<NativeStackNavigationProp<AppStackParamList>>()

    const { activeFilter, customRange, afterTime, beforeTime, openFilter } =
        useAccountHistoryFilter()

    const {
        rows,
        transactionCount,
        isLoading,
        isFetched,
        isFetchingNextPage,
        isError,
        error,
        hasNextPage,
        isSearchPaused,
        retry: handleRetry,
        isRetrying,
        isLoadFailed,
        isLoadUnavailable,
        isLoadIntegrityBlocked,
        suspectedPoisoningById,
        scope,
        accountAddress,
        networkChainId,
        isMerged,
        chainFilterOptions,
        handleSelectChain,
        historyFeeds,
        failedNetworkNames,
        unavailableNetworkNames,
        handleLoadMore,
        handleSearchOlder,
        handleRefresh,
        isRefreshing,
        scopeOf,
    } = useAccountHistoryRows({ afterTime, beforeTime })

    // The event needs one chain, so on All it names the account's own; a
    // filter there covers every network.
    const handleOpenFilter = useCallback(
        () => openFilter(scope.chainId),
        [openFilter, scope.chainId],
    )

    const { t } = useLanguage()
    const styles = useStyles()
    const { handleExportCsv, isExportingCsv, isCsvExportVisible } =
        useAccountHistoryCsvExport({
            scope,
            accountAddress,
            transactionCount,
            isMerged,
        })

    const handleTransactionPress = useCallback(
        (transaction: TransactionHistoryItem) => {
            const rowScope = scopeOf(transaction.id)
            const groupId = historyItemGroupToOpen(
                transaction,
                rowScope.chainId,
            )
            if (groupId) {
                navigation.navigate('GroupTransactionList', {
                    groupId,
                    historyTransaction: transaction,
                })
            } else {
                navigation.navigate('TransactionDetails', {
                    scope: rowScope,
                    transactionId: transaction.id,
                    historyTransaction: transaction,
                    suspectedPoisoning: suspectedPoisoningById.get(
                        transaction.id,
                    ),
                })
            }
        },
        [navigation, scopeOf, suspectedPoisoningById],
    )

    // Gated on `isFetched`, not `!isLoading`: the query is disabled until the
    // selected account resolves, and a disabled query reports `isLoading:
    // false` with no rows — which rendered "no transactions" over a history
    // that had not been read yet.
    // `!hasNextPage` too: an empty local cache still has an API page
    // queued behind it, and calling that empty would flash the wrong
    // answer for the length of one request.
    // A failed read is never empty, even while it is re-read.
    const isEmpty =
        isFetched && !isLoadFailed && !hasNextPage && transactionCount === 0
    const isOfflineEmpty = isEmpty && !hasInternet
    // The failed read happened offline, so it gets the offline copy, not the error one.
    const isLoadOffline = isLoadFailed && !hasInternet
    const isInitialLoad =
        !isLoadFailed &&
        !isSearchPaused &&
        rows.length === 0 &&
        (!isFetched || hasNextPage)

    const emptyBody =
        networkChainId === null
            ? t('asset_details.transaction_list.empty_body')
            : t('asset_details.transaction_list.empty_on_network_body', {
                  network: chainDisplayNameOf(networkChainId) ?? networkChainId,
              })

    const renderItem = useCallback(
        ({ item }: { item: TransactionListRow }) => (
            <TransactionHistoryRow
                row={item}
                onTransactionPress={handleTransactionPress}
                suspectedPoisoning={suspectedPoisoningById.get(item.key)}
            />
        ),
        [handleTransactionPress, suspectedPoisoningById],
    )

    const renderFooter = useCallback(() => {
        if (isFetchingNextPage) {
            return (
                <PWView style={styles.loadingFooter}>
                    <PWLoadingIndicator size='sm' />
                </PWView>
            )
        }
        if (isSearchPaused) {
            return (
                <PWView style={styles.loadingFooter}>
                    <TransactionHistorySearchOlder
                        onPress={handleSearchOlder}
                    />
                </PWView>
            )
        }
        return null
    }, [
        isFetchingNextPage,
        isSearchPaused,
        handleSearchOlder,
        styles.loadingFooter,
    ])

    const handleFilterPress = useCallback(() => {
        void handleOpenFilter()
    }, [handleOpenFilter])

    return {
        rows,
        isLoading,
        isInitialLoad,
        isLoadFailed,
        isLoadUnavailable,
        isLoadIntegrityBlocked,
        isLoadOffline,
        handleRetry,
        isRetrying,
        isSearchPaused,
        handleSearchOlder,
        isFetchingNextPage,
        isError,
        error,
        hasNextPage,
        handleLoadMore,
        handleRefresh,
        isRefreshing,
        renderItem,
        renderFooter,
        handleFilterPress,
        isEmpty,
        networkChainId,
        chainFilterOptions,
        handleSelectChain,
        isMerged,
        historyFeeds,
        failedNetworkNames,
        unavailableNetworkNames,
        emptyBody,
        isOfflineEmpty,
        handleExportCsv,
        isExportingCsv,
        isCsvExportVisible,
        activeFilter,
        customRange,
        handleOpenFilter,
        handleTransactionPress,
        suspectedPoisoningById,
    }
}
