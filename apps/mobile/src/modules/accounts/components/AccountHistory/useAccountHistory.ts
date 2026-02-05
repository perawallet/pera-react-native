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

import { useMemo, useCallback } from 'react'
import { Share } from 'react-native'
import { useSelectedAccount } from '@perawallet/wallet-core-accounts'
import { useNetwork } from '@perawallet/wallet-core-platform-integration'
import { useToast } from '@hooks/useToast'
import { useLanguage } from '@hooks/useLanguage'
import {
    useTransactionHistoryQuery,
    useCsvExportMutation,
    type TransactionHistoryItem,
} from '@perawallet/wallet-core-transactions'

/**
 * Represents a section of transactions grouped by date.
 */
export type TransactionSection = {
    /** Date string used as section key */
    date: string
    /** Human-readable date title */
    title: string
    /** Transactions in this section */
    data: TransactionHistoryItem[]
}

/**
 * Return type for useAccountHistory hook.
 */
export type UseAccountHistoryResult = {
    /** Sections grouped by date for SectionList */
    sections: TransactionSection[]
    /** Whether initial data is loading */
    isLoading: boolean
    /** Whether more data is being fetched */
    isFetchingNextPage: boolean
    /** Whether there was an error */
    isError: boolean
    /** Error if one occurred */
    error: Error | null
    /** Whether there are more pages */
    hasNextPage: boolean
    /** Function to load more transactions */
    handleLoadMore: () => void
    /** Function to refresh the list */
    handleRefresh: () => void
    /** Whether data is empty */
    isEmpty: boolean
    /** Function to export transaction history to CSV */
    handleExportCsv: () => void
    /** Whether CSV export is in progress */
    isExportingCsv: boolean
}

/**
 * Formats a Unix timestamp to a human-readable date string.
 */
const formatDate = (roundTime: number): string => {
    const date = new Date(roundTime * 1000)
    return date.toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric',
        year: 'numeric',
    })
}

/**
 * Gets a date key for grouping (YYYY-MM-DD format).
 */
const getDateKey = (roundTime: number): string => {
    const date = new Date(roundTime * 1000)
    return date.toISOString().split('T')[0]
}

/**
 * Groups transactions by date into sections.
 */
const groupTransactionsByDate = (
    transactions: TransactionHistoryItem[],
): TransactionSection[] => {
    const groups: Record<string, TransactionHistoryItem[]> = {}
    const dateFormats: Record<string, string> = {}

    transactions.forEach(tx => {
        const dateKey = getDateKey(tx.roundTime)
        if (!groups[dateKey]) {
            groups[dateKey] = []
            dateFormats[dateKey] = formatDate(tx.roundTime)
        }
        groups[dateKey].push(tx)
    })

    return Object.entries(groups)
        .sort(([a], [b]) => b.localeCompare(a)) // Sort by date descending
        .map(([date, data]) => ({
            date,
            title: dateFormats[date],
            data,
        }))
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

    const {
        transactions,
        isLoading,
        isFetchingNextPage,
        isError,
        error,
        hasNextPage,
        fetchNextPage,
        refetch,
    } = useTransactionHistoryQuery({
        accountAddress: account?.address ?? '',
        network,
        isEnabled: !!account?.address,
    })

    const sections = useMemo(
        () => groupTransactionsByDate(transactions),
        [transactions],
    )

    const handleLoadMore = useCallback(() => {
        if (hasNextPage && !isFetchingNextPage) {
            fetchNextPage()
        }
    }, [hasNextPage, isFetchingNextPage, fetchNextPage])

    const handleRefresh = useCallback(() => {
        refetch()
    }, [refetch])

    const { t } = useLanguage()
    const { showToast } = useToast()

    const { exportCsv, isLoading: isExportingCsv } = useCsvExportMutation({
        network,
        onSuccess: async result => {
            try {
                await Share.share({
                    title: result.filename,
                    message: result.csvContent,
                })
            } catch (error) {
                showToast({
                    title: t('errors.general.title'),
                    body: `${error}`,
                    type: 'error',
                })
            }
        },
        onError: error => {
            showToast({
                title: t('errors.general.title'),
                body: error?.message || t('errors.general.body'),
                type: 'error',
            })
        },
    })

    const handleExportCsv = useCallback(() => {
        if (account?.address) {
            exportCsv({ accountAddress: account.address })
        }
    }, [account?.address, exportCsv])

    const isEmpty = !isLoading && transactions.length === 0

    return {
        sections,
        isLoading,
        isFetchingNextPage,
        isError,
        error,
        hasNextPage,
        handleLoadMore,
        handleRefresh,
        isEmpty,
        handleExportCsv,
        isExportingCsv,
    }
}
