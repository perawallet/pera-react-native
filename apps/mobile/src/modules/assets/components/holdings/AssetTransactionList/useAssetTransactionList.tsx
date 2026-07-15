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
import type { WalletAccount } from '@perawallet/wallet-core-accounts'
import { useNetwork } from '@perawallet/wallet-core-blockchain'
import {
    useTransactionHistoryQuery,
    useCsvExportMutation,
    type TransactionHistoryItem,
} from '@perawallet/wallet-core-transactions'
import { shareCsvFile } from '@utils/shareCsvFile'
import { useBottomSheet } from '@modules/bottom-sheet'
import {
    TransactionFilter,
    TransactionsFilterContent,
    type CustomDateRange,
    type TransactionsFilterResult,
} from '../../../../accounts/components/TransactionsFilterContent'
import type { AppStackParamList } from '@routes/types'
import {
    groupTransactionsByDate,
    getFilterTimes,
} from '../../../../accounts/components/AccountHistory/utils'
import type { TransactionSection } from '../../../../accounts/components/AccountHistory/useAccountHistory'
import type { PeraAsset } from '@perawallet/wallet-core-assets'
import type { Nullable } from '@perawallet/wallet-core-shared'
import { useErrorToast } from '@hooks/useErrorToast'

type UseAssetTransactionListParams = {
    account: WalletAccount
    asset: PeraAsset
}

export type UseAssetTransactionListResult = {
    sections: TransactionSection[]
    isLoading: boolean
    isFetchingNextPage: boolean
    isError: boolean
    error: Nullable<Error>
    hasNextPage: boolean
    isEmpty: boolean
    handleLoadMore: () => void
    handleRefresh: () => void
    handleExportCsv: () => void
    isExportingCsv: boolean
    isCsvExportVisible: boolean
    activeFilter: TransactionFilter
    customRange?: CustomDateRange
    handleTransactionPress: (transaction: TransactionHistoryItem) => void
    handleOpenFilter: () => void
}

export const useAssetTransactionList = ({
    account,
    asset,
}: UseAssetTransactionListParams): UseAssetTransactionListResult => {
    const { network } = useNetwork()
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
        transactions,
        isLoading,
        isFetchingNextPage,
        isError,
        error,
        hasNextPage,
        fetchNextPage,
        refetch,
    } = useTransactionHistoryQuery({
        accountAddress: account.address,
        network,
        isEnabled: !!account.address,
        afterTime,
        beforeTime,
        assetId,
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

    const { showError } = useErrorToast()

    const { exportCsv, isLoading: isExportingCsv } = useCsvExportMutation({
        network,
        onSuccess: result => {
            void (async () => {
                try {
                    await shareCsvFile(result.filename, result.csvContent)
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
        if (account.address) {
            exportCsv({
                accountAddress: account.address,
                assetId,
            })
        }
    }, [account.address, assetId, exportCsv])

    const handleTransactionPress = useCallback(
        (transaction: TransactionHistoryItem) => {
            if (transaction.swapGroupDetail && transaction.groupId) {
                navigation.navigate('GroupTransactionList', {
                    groupId: transaction.groupId,
                })
            } else {
                navigation.navigate('TransactionDetails', {
                    transactionId: transaction.id,
                })
            }
        },
        [navigation],
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

    const isEmpty = !isLoading && transactions.length === 0
    // CSV export is only meaningful when there are transactions to export.
    // The Pera export-history endpoint returns 404 for empty histories, so
    // hiding the button avoids a guaranteed-failure user action. Gating on
    // `transactions.length > 0` rather than `!isEmpty` also keeps the button
    // hidden during the initial load (when results may still end up empty),
    // avoiding a brief visible-then-gone flicker.
    const isCsvExportVisible = transactions.length > 0

    return {
        sections,
        isLoading,
        isFetchingNextPage,
        isError,
        error,
        hasNextPage,
        isEmpty,
        handleLoadMore,
        handleRefresh,
        handleExportCsv,
        isExportingCsv,
        isCsvExportVisible,
        activeFilter,
        customRange,
        handleTransactionPress,
        handleOpenFilter: () => void handleOpenFilter(),
    }
}
