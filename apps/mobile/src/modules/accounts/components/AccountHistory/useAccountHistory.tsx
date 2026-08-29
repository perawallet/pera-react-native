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
import { useSelectedAccount } from '@perawallet/wallet-core-accounts'
import { useNetwork } from '@perawallet/wallet-core-blockchain'
import { useErrorToast } from '@hooks/useErrorToast'
import { useLanguage } from '@hooks/useLanguage'
import { useSyncRefresh } from '@hooks/useSyncRefresh'
import {
    useTransactionHistoryQuery,
    useCsvExportMutation,
    type TransactionHistoryItem,
} from '@perawallet/wallet-core-transactions'
import { shareCsvFile } from '@utils/shareCsvFile'
import { trackEvent, AccountDetailsEvent } from '@analytics'
import { useBottomSheet } from '@modules/bottom-sheet'
import {
    TransactionFilter,
    TransactionsFilterContent,
    type CustomDateRange,
    type TransactionsFilterResult,
} from '../TransactionsFilterContent'
import type { AppStackParamList } from '@routes/types'
import { getFilterTimes } from './utils'
import {
    buildTransactionListRows,
    type TransactionListRow,
} from '@modules/transactions/utils/transactionListRows'
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
}

/**
 * Hook that manages the transaction history state and logic for AccountHistory.
 *
 * Extracts all complex logic from the component following the component-level
 * hook pattern described in the project rules.
 */
export const useAccountHistory = (): UseAccountHistoryResult => {
    const account = useSelectedAccount()
    const { network } = useNetwork()
    const navigation =
        useNavigation<NativeStackNavigationProp<AppStackParamList>>()

    const [activeFilter, setActiveFilter] = useState<TransactionFilter>(
        TransactionFilter.AllTime,
    )
    const [customRange, setCustomRange] = useState<CustomDateRange>()
    const { request: requestBottomSheet } = useBottomSheet()

    const handleOpenFilter = useCallback(async () => {
        trackEvent(AccountDetailsEvent.TransactionFilter)
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

    const { afterTime, beforeTime } = useMemo(
        () => getFilterTimes(activeFilter, customRange),
        [activeFilter, customRange],
    )

    const {
        transactions,
        isLoading,
        isFetched,
        isFetchingNextPage,
        isError,
        error,
        hasNextPage,
        fetchNextPage,
    } = useTransactionHistoryQuery({
        accountAddress: account?.address ?? '',
        network,
        isEnabled: !!account?.address,
        afterTime,
        beforeTime,
    })

    const rows = useMemo(
        () => buildTransactionListRows(transactions),
        [transactions],
    )

    const handleLoadMore = useCallback(() => {
        if (hasNextPage && !isFetchingNextPage) {
            fetchNextPage()
        }
    }, [hasNextPage, isFetchingNextPage, fetchNextPage])

    const refreshAddresses = useMemo(
        () => (account?.address ? [account.address] : []),
        [account?.address],
    )
    const { isRefreshing, refresh: handleRefresh } = useSyncRefresh({
        addresses: refreshAddresses,
    })

    const { t } = useLanguage()
    const { showError } = useErrorToast()

    const {
        exportCsv,
        isLoading: isExportingCsv,
        isUnavailableOnNetwork,
    } = useCsvExportMutation({
        network,
        onSuccess: result => {
            void (async () => {
                try {
                    await shareCsvFile(result.filename, result.csvContent)
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
        trackEvent(AccountDetailsEvent.TransactionDownload)
        // Guarding the request would silence's central toast too, so
        // the reason has to be raised here or the button would do nothing.
        if (isUnavailableOnNetwork) {
            showError(
                new PeraServiceUnavailableError(network),
                t('common.network_unavailable.title'),
            )
            return
        }
        if (account?.address) {
            exportCsv({ accountAddress: account.address })
        }
    }, [
        account?.address,
        exportCsv,
        isUnavailableOnNetwork,
        network,
        showError,
        t,
    ])

    const handleTransactionPress = useCallback(
        (transaction: TransactionHistoryItem) => {
            if (transaction.swapGroupDetail && transaction.groupId) {
                navigation.navigate('GroupTransactionList', {
                    groupId: transaction.groupId,
                })
            } else {
                navigation.navigate('TransactionDetails', {
                    transactionId: transaction.id,
                    historyTransaction: transaction,
                })
            }
        },
        [navigation],
    )

    // Gated on `isFetched`, not `!isLoading`: the query is disabled until the
    // selected account resolves, and a disabled query reports `isLoading:
    // false` with no rows — which rendered "no transactions" over a history
    // that had not been read yet.
    // `!hasNextPage` too: an empty local cache still has an API page
    // queued behind it, and calling that empty would flash the wrong
    // answer for the length of one request.
    const isEmpty = isFetched && !hasNextPage && transactions.length === 0
    const isInitialLoad = rows.length === 0 && (!isFetched || hasNextPage)
    // CSV export is only meaningful when there are transactions to export.
    // The Pera export-history endpoint returns 404 for empty histories, so
    // hiding the button avoids a guaranteed-failure user action. Gating on
    // `transactions.length > 0` rather than `!isEmpty` also keeps the button
    // hidden during the initial load (when results may still end up empty),
    // avoiding a brief visible-then-gone flicker.
    const isCsvExportVisible = transactions.length > 0

    return {
        rows,
        isLoading,
        isInitialLoad,
        isFetchingNextPage,
        isError,
        error,
        hasNextPage,
        handleLoadMore,
        handleRefresh,
        isRefreshing,
        isEmpty,
        handleExportCsv,
        isExportingCsv,
        isCsvExportVisible,
        activeFilter,
        customRange,
        handleOpenFilter,
        handleTransactionPress,
    }
}
