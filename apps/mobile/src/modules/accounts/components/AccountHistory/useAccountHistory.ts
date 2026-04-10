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

import { useMemo, useCallback, useState } from 'react'
import { Share } from 'react-native'
import { useNavigation } from '@react-navigation/native'
import type { NativeStackNavigationProp } from '@react-navigation/native-stack'
import { useSelectedAccount } from '@perawallet/wallet-core-accounts'
import { useNetwork } from '@perawallet/wallet-core-blockchain'
import { useToast } from '@hooks/useToast'
import { useLanguage } from '@hooks/useLanguage'
import {
    useTransactionHistoryQuery,
    useCsvExportMutation,
    type TransactionHistoryItem,
} from '@perawallet/wallet-core-transactions'
import {
    TransactionFilter,
    type CustomDateRange,
} from '../TransactionsFilterBottomSheet'
import type { AppStackParamList } from '@routes/types'
import { groupTransactionsByDate, getFilterTimes } from './utils'

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

    /** Current active filter */
    activeFilter: TransactionFilter
    /** Current custom range if active */
    customRange?: CustomDateRange
    /** Function to apply a new filter */
    handleApplyFilter: (
        filter: TransactionFilter,
        range?: CustomDateRange,
    ) => void
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

    const { afterTime, beforeTime } = useMemo(
        () => getFilterTimes(activeFilter, customRange),
        [activeFilter, customRange],
    )

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
        afterTime,
        beforeTime,
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

    const handleTransactionPress = useCallback(
        (transaction: TransactionHistoryItem) => {
            if (transaction.swapGroupDetail && transaction.groupId) {
                navigation.navigate('GroupTransactionList', {
                    groupId: transaction.groupId,
                })
            } else {
                navigation.navigate('TransactionDetails', {
                    transactionId: transaction.id,
                    groupId: transaction.groupId ?? undefined,
                })
            }
        },
        [navigation],
    )

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
        activeFilter,
        customRange,
        handleApplyFilter: (
            filter: TransactionFilter,
            range?: CustomDateRange,
        ) => {
            setActiveFilter(filter)
            if (range) {
                setCustomRange(range)
            }
        },
        handleTransactionPress,
    }
}
