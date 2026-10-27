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
import {
    chainAccountOf,
    type WalletAccount,
} from '@perawallet/wallet-core-accounts'
import {
    CSV_MIME_TYPE,
    historyItemGroupToOpen,
    useCsvExportMutation,
    type SuspectedPoisoning,
    type TransactionHistoryItem,
} from '@perawallet/wallet-core-transactions'
import { shareFile } from '@utils/shareFile'
import { useBottomSheet } from '@modules/bottom-sheet'
import { useNetworkStatus } from '@modules/network'
import {
    TransactionFilter,
    TransactionsFilterContent,
    type CustomDateRange,
    type TransactionsFilterResult,
    getFilterTimes,
} from '@modules/accounts'
import type { AppStackParamList } from '@routes/types'
import {
    useTransactionHistoryRows,
    type TransactionListRow,
} from '@modules/transactions'
import type { PeraAsset } from '@perawallet/wallet-core-assets'
import {
    PeraServiceUnavailableError,
    type Nullable,
} from '@perawallet/wallet-core-shared'
import type { ChainScope } from '@perawallet/wallet-core-chain-contract'
import {
    useChainCapability,
    useIsCapabilityRestricted,
} from '@perawallet/wallet-core-chain-shared'
import { useErrorToast } from '@hooks/useErrorToast'
import { useLanguage } from '@hooks/useLanguage'
import { useSyncRefresh } from '@hooks/useSyncRefresh'

type UseAssetTransactionListParams = {
    account: WalletAccount
    asset: PeraAsset
    scope: ChainScope
}

export type UseAssetTransactionListResult = {
    /** Date headers and transaction rows, flattened for a recycling list */
    rows: TransactionListRow[]
    isLoading: boolean
    /** Whether to render the cold-start skeleton (no read has resolved yet) */
    isInitialLoad: boolean
    /** See `useAccountHistory` for these load states. */
    isLoadFailed: boolean
    isLoadUnavailable: boolean
    isLoadIntegrityBlocked: boolean
    isLoadOffline: boolean
    handleRetry: () => void
    isRetrying: boolean
    isSearchPaused: boolean
    handleSearchOlder: () => void
    isFetchingNextPage: boolean
    isError: boolean
    error: Nullable<Error>
    hasNextPage: boolean
    isEmpty: boolean
    /** See `useAccountHistory`: empty because nothing is cached and we're offline. */
    isOfflineEmpty: boolean
    handleLoadMore: () => void
    handleRefresh: () => void
    isRefreshing: boolean
    handleExportCsv: () => void
    isExportingCsv: boolean
    isCsvExportVisible: boolean
    activeFilter: TransactionFilter
    customRange?: CustomDateRange
    handleTransactionPress: (transaction: TransactionHistoryItem) => void
    handleOpenFilter: () => void
    /** Keyed by transaction id. */
    suspectedPoisoningById: ReadonlyMap<string, SuspectedPoisoning>
}

export const useAssetTransactionList = ({
    account,
    asset,
    scope,
}: UseAssetTransactionListParams): UseAssetTransactionListResult => {
    const accountAddress = chainAccountOf(account, scope.chainId)?.address ?? ''
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

    const assetId = asset.assetId

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
        fetchNextPage,
        retry: handleRetry,
        isRetrying,
        isLoadFailed,
        isLoadUnavailable,
        isLoadIntegrityBlocked,
        suspectedPoisoningById,
    } = useTransactionHistoryRows({
        accountAddress,
        scope,
        afterTime,
        beforeTime,
        assetId,
    })

    // A paused search waits for Search Older, not for the list's end.
    const handleLoadMore = useCallback(() => {
        if (hasNextPage && !isFetchingNextPage && !isSearchPaused) {
            fetchNextPage()
        }
    }, [hasNextPage, isFetchingNextPage, isSearchPaused, fetchNextPage])

    const refreshAddresses = useMemo(() => [accountAddress], [accountAddress])
    const { isRefreshing, refresh: handleRefresh } = useSyncRefresh({
        addresses: refreshAddresses,
        scope,
    })

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
                    showError(error)
                }
            })()
        },
        onError: error => {
            showError(error)
        },
    })

    const handleExportCsv = useCallback(() => {
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
            exportCsv({
                accountAddress,
                assetId,
            })
        }
    }, [
        accountAddress,
        assetId,
        exportCsv,
        isUnavailableOnNetwork,
        scope,
        showError,
        t,
    ])

    const handleTransactionPress = useCallback(
        (transaction: TransactionHistoryItem) => {
            const groupId = historyItemGroupToOpen(transaction, scope.chainId)
            if (groupId) {
                navigation.navigate('GroupTransactionList', { groupId })
            } else {
                navigation.navigate('TransactionDetails', {
                    scope,
                    transactionId: transaction.id,
                    historyTransaction: transaction,
                    suspectedPoisoning: suspectedPoisoningById.get(
                        transaction.id,
                    ),
                })
            }
        },
        [navigation, scope, suspectedPoisoningById],
    )

    const handleOpenFilter = useCallback(async () => {
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
    }, [requestBottomSheet, activeFilter, customRange])

    // Gated on `isFetched`, not `!isLoading`: a query that has not run yet
    // reports `isLoading: false` with no rows, which rendered "no
    // transactions" over a history nobody had read.
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
    // avoiding a brief visible-then-gone flicker. Capability-gated as in
    // `useAccountHistory`.
    const hasCsvExport = useChainCapability(scope.chainId, 'csvExport')
    const isCsvExportRestricted = useIsCapabilityRestricted(
        scope.chainId,
        'csvExport',
    )
    const isCsvExportVisible =
        transactionCount > 0 && (hasCsvExport || isCsvExportRestricted)

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
        handleSearchOlder: fetchNextPage,
        isFetchingNextPage,
        isError,
        error,
        hasNextPage,
        isEmpty,
        isOfflineEmpty,
        handleLoadMore,
        handleRefresh,
        isRefreshing,
        handleExportCsv,
        isExportingCsv,
        isCsvExportVisible,
        activeFilter,
        customRange,
        handleTransactionPress,
        suspectedPoisoningById,
        handleOpenFilter: () => void handleOpenFilter(),
    }
}
