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

import { useCallback } from 'react'
import { PWFlatList, PWScreen } from '@components/core'
import { LoadingView } from '@components/LoadingView'
import { EmptyView } from '@components/EmptyView'
import { useLanguage } from '@hooks/useLanguage'
import { TransactionPreview } from '@modules/transactions/components/transaction-details/TransactionPreview'
import { GroupDetailHeader } from '@modules/signing/screens/GroupDetailScreen'
import type { PeraDisplayableTransaction } from '@perawallet/wallet-core-blockchain'
import { useGroupTransactionListScreen } from './useGroupTransactionListScreen'

export const GroupTransactionListScreen = () => {
    const { t } = useLanguage()
    const {
        transactions,
        isLoading,
        isError,
        handleTransactionPress,
        keyExtractor,
    } = useGroupTransactionListScreen()

    const renderItem = useCallback(
        ({ item }: { item: PeraDisplayableTransaction }) => (
            <TransactionPreview
                transaction={item}
                onPress={() => handleTransactionPress(item)}
            />
        ),
        [handleTransactionPress],
    )

    if (isLoading) {
        return (
            <LoadingView
                variant='circle'
                size='lg'
            />
        )
    }

    if (isError || transactions.length === 0) {
        return (
            <EmptyView
                title={t('errors.general.title')}
                body={t('errors.general.body')}
            />
        )
    }

    return (
        <PWScreen scroll={false}>
            <GroupDetailHeader transactionCount={transactions.length} />
            <PWFlatList
                data={transactions}
                renderItem={renderItem}
                keyExtractor={keyExtractor}
                recycleItems
            />
        </PWScreen>
    )
}
