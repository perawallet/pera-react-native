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

import { useMemo, useCallback, useState } from 'react'
import { useNavigation } from '@react-navigation/native'
import type { NativeStackNavigationProp } from '@react-navigation/native-stack'
import type { ChainId } from '@perawallet/wallet-core-chain-contract'
import type { FilterOption } from '@components/FilterSelection'
import {
    chainDisplayNameOf,
    useChainCapability,
    useIsCapabilityRestricted,
} from '@perawallet/wallet-core-chain-shared'
import { useErrorToast } from '@hooks/useErrorToast'
import { useLanguage } from '@hooks/useLanguage'
import {
    CSV_MIME_TYPE,
    historyItemGroupToOpen,
    useCsvExportMutation,
    type SuspectedPoisoning,
    type TransactionHistoryItem,
} from '@perawallet/wallet-core-transactions'
import { shareFile } from '@utils/shareFile'
import {
    trackEvent,
    AccountDetailsEvent,
    AnalyticsMetadataKey,
} from '@analytics'
import { useBottomSheet } from '@modules/bottom-sheet'
import { useNetworkStatus } from '@modules/network'
import {
    TransactionFilter,
    TransactionsFilterContent,
    type CustomDateRange,
    type TransactionsFilterResult,
} from '../TransactionsFilterContent'
import type { AppStackParamList } from '@routes/types'
import { getFilterTimes } from './utils'
import type {
    HistoryFeedProps,
    TransactionListRow,
} from '@modules/transactions'
import { useAccountHistoryRows } from './useAccountHistoryRows'
import {
    PeraServiceUnavailableError,
    type Nullable,
} from '@perawallet/wallet-core-shared'

/**
 * Return type for useAccountHistory hook.
 */
export type UseAccountHistoryResult = {
    /** Date headers and transaction rows, flattened for a recycling list */
    rows: TransactionListRow[]
    /** Whether initial data is loading */
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
    /** Whether more data is being fetched */
    isFetchingNextPage: boolean
    /** Whether there was an error */
    isError: boolean
    /** Error if one occurred */
    error: Nullable<Error>
    /** Whether there are more pages */
    hasNextPage: boolean
    /** Function to load more transactions */
    handleLoadMore: () => void
    /** Function to refresh the list */
    handleRefresh: () => void
    /** Whether a refresh is in flight */
    isRefreshing: boolean
    /** Whether data is empty */
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
    /** Networks a merged history couldn't read while the others' rows show; retried by `handleRetry`. */
    failedNetworkNames: string[]
    /** What an empty history says, naming the network when narrowed to one. */
    emptyBody: string
    /**
     * Empty *because* nothing is cached and we're offline, rather than because
     * the account has no transactions. The history query reads SQLite with
     * `networkMode: 'always'`, so it never reports `isPaused` — connectivity
     * has to come from the network store instead.
     */
    isOfflineEmpty: boolean
    /** Function to export transaction history to CSV */
    handleExportCsv: () => void
    /** Whether CSV export is in progress */
    isExportingCsv: boolean
    /** Whether the CSV export action should be offered to the user */
    isCsvExportVisible: boolean

    /** Current active filter */
    activeFilter: TransactionFilter
    /** Current custom range if active */
    customRange?: CustomDateRange
    /** Function to open the filter bottom sheet */
    handleOpenFilter: () => Promise<void>
    /** Function to handle pressing a transaction item */
    handleTransactionPress: (transaction: TransactionHistoryItem) => void
    /** Keyed by transaction id. */
    suspectedPoisoningById: ReadonlyMap<string, SuspectedPoisoning>
}

/**
 * Hook that manages the transaction history state and logic for AccountHistory.
 *
 * Extracts all complex logic from the component following the component-level
 * hook pattern described in the project rules.
 */
export const useAccountHistory = (): UseAccountHistoryResult => {
    const { hasInternet } = useNetworkStatus()
    const navigation =
        useNavigation<NativeStackNavigationProp<AppStackParamList>>()

    const [activeFilter, setActiveFilter] = useState<TransactionFilter>(
        TransactionFilter.AllTime,
    )
    const [customRange, setCustomRange] = useState<CustomDateRange>()
    const { request: requestBottomSheet } = useBottomSheet()

    const { afterTime, beforeTime } = useMemo(
        () => getFilterTimes(activeFilter, customRange),
        [activeFilter, customRange],
    )

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
        handleLoadMore,
        handleSearchOlder,
        handleRefresh,
        isRefreshing,
        scopeOf,
    } = useAccountHistoryRows({ afterTime, beforeTime })

    // The event needs one chain, so on All it names the account's own; a
    // filter there covers every network.
    const handleOpenFilter = useCallback(async () => {
        trackEvent(AccountDetailsEvent.TransactionFilter, {
            [AnalyticsMetadataKey.ChainId]: scope.chainId,
        })
        const result = await requestBottomSheet<TransactionsFilterResult>({
            contents: (
                <TransactionsFilterContent
                    activeFilter={activeFilter}
                    initialCustomRange={customRange}
                />
            ),
            options: { size: 'auto', enablePanDownToClose: true },
        })
        if (!result) return
        setActiveFilter(result.filter)
        if (result.customRange) {
            setCustomRange(result.customRange)
        }
    }, [requestBottomSheet, activeFilter, customRange, scope.chainId])

    const { t } = useLanguage()
    const { showError } = useErrorToast()

    const {
        exportCsv,
        isLoading: isExportingCsv,
        isUnavailableOnNetwork,
    } = useCsvExportMutation({
        scope,
        onSuccess: result => {
            void (async () => {
                try {
                    await shareFile(result.filename, result.csvContent, {
                        mimeType: CSV_MIME_TYPE,
                    })
                } catch (error) {
                    showError(error, t('errors.general.title'))
                }
            })()
        },
        onError: error => {
            showError(error, t('errors.general.title'))
        },
    })

    const handleExportCsv = useCallback(() => {
        trackEvent(AccountDetailsEvent.TransactionDownload, {
            [AnalyticsMetadataKey.ChainId]: scope.chainId,
        })
        // Guarding the request would silence's central toast too, so
        // the reason has to be raised here or the button would do nothing.
        if (isUnavailableOnNetwork) {
            showError(
                new PeraServiceUnavailableError(scope),
                t('common.network_unavailable.title'),
            )
            return
        }
        if (accountAddress) {
            exportCsv({ accountAddress })
        }
    }, [accountAddress, exportCsv, isUnavailableOnNetwork, scope, showError, t])

    const handleTransactionPress = useCallback(
        (transaction: TransactionHistoryItem) => {
            const rowScope = scopeOf(transaction.id)
            const groupId = historyItemGroupToOpen(
                transaction,
                rowScope.chainId,
            )
            if (groupId) {
                navigation.navigate('GroupTransactionList', { groupId })
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
    const isEmpty = isFetched && !hasNextPage && transactionCount === 0
    const isOfflineEmpty = isEmpty && !hasInternet
    // The failed read happened offline, so it gets the offline copy, not the error one.
    const isLoadOffline = isLoadFailed && !hasInternet
    const isInitialLoad =
        !isLoadFailed &&
        !isSearchPaused &&
        rows.length === 0 &&
        (!isFetched || hasNextPage)
    // CSV export is only meaningful when there are transactions to export.
    // The Pera export-history endpoint returns 404 for empty histories, so
    // hiding the button avoids a guaranteed-failure user action. Gating on
    // `transactionCount > 0` rather than `!isEmpty` also keeps the button
    // hidden during the initial load (when results may still end up empty),
    // avoiding a brief visible-then-gone flicker.
    // A chain whose build has no CSV export hides the action outright; one that
    // only restricts it on this network (BetaNet, custom) keeps it to explain why.
    const hasCsvExport = useChainCapability(scope.chainId, 'csvExport')
    const isCsvExportRestricted = useIsCapabilityRestricted(
        scope.chainId,
        'csvExport',
    )
    // Export is per network: on a merged history it would cover only one of them.
    const isCsvExportVisible =
        !isMerged &&
        transactionCount > 0 &&
        (hasCsvExport || isCsvExportRestricted)

    const emptyBody =
        networkChainId === null
            ? t('asset_details.transaction_list.empty_body')
            : t('asset_details.transaction_list.empty_on_network_body', {
                  network: chainDisplayNameOf(networkChainId) ?? networkChainId,
              })

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
        isEmpty,
        networkChainId,
        chainFilterOptions,
        handleSelectChain,
        isMerged,
        historyFeeds,
        failedNetworkNames,
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
