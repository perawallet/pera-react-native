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
import { useNavigation } from '@react-navigation/native'
import { type NativeStackNavigationProp } from '@react-navigation/native-stack'
import { useCardTransactionsQuery } from '@perawallet/wallet-core-card'
import { useCardComingSoonToast } from '../../hooks'
import { type PeraCardAccountStackParamList } from '../../routes/types'
import {
    groupCardTransactionsByMonth,
    type CardTransactionSection,
} from '../../utils/cardTransactions'

type UseCardTransactionsResult = {
    sections: CardTransactionSection[]
    isLoading: boolean
    isFetchingNextPage: boolean
    isError: boolean
    isEmpty: boolean
    handleLoadMore: () => void
    handleRetry: () => void
    onExport: () => void
    onPressTransaction: (id: string) => void
}

export const useCardTransactions = (): UseCardTransactionsResult => {
    const navigation =
        useNavigation<
            NativeStackNavigationProp<PeraCardAccountStackParamList>
        >()
    const {
        transactions,
        isLoading,
        isFetchingNextPage,
        isError,
        hasNextPage,
        fetchNextPage,
        refetch,
    } = useCardTransactionsQuery()
    const showComingSoon = useCardComingSoonToast()

    const sections = useMemo(
        () => groupCardTransactionsByMonth(transactions),
        [transactions],
    )

    const handleLoadMore = useCallback(() => {
        if (hasNextPage && !isFetchingNextPage) {
            void fetchNextPage()
        }
    }, [hasNextPage, isFetchingNextPage, fetchNextPage])

    const handleRetry = useCallback(() => {
        void refetch()
    }, [refetch])

    const onPressTransaction = useCallback(
        (id: string) => {
            navigation.navigate('CardTransactionDetail', { id })
        },
        [navigation],
    )

    return {
        sections,
        isLoading,
        isFetchingNextPage,
        isError,
        isEmpty: !isLoading && transactions.length === 0,
        handleLoadMore,
        handleRetry,
        // TODO(card): wire to exportCardStatement + a share sheet; stubbed for now.
        onExport: showComingSoon,
        onPressTransaction,
    }
}
