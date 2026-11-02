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
    useNavigation,
    useRoute,
    type RouteProp,
} from '@react-navigation/native'
import type { NativeStackNavigationProp } from '@react-navigation/native-stack'
import {
    chainAccountOf,
    useSelectedAccount,
} from '@perawallet/wallet-core-accounts'
import { useAssetsQuery } from '@perawallet/wallet-core-assets'
import { useGroupTransactionsQuery } from '@perawallet/wallet-core-chain-algorand/blockchain'
import { LEGACY_CHAIN_ID } from '@perawallet/wallet-core-chain-contract'
import { useSelectedScope } from '@perawallet/wallet-core-chain-shared'
import {
    baseUnitsToDisplayUnits,
    type Optional,
} from '@perawallet/wallet-core-shared'
import { summarizeHistoryItem } from '@perawallet/wallet-core-transactions'
import { transactionIconName } from '@components/TransactionIcon'
import {
    useTransactionHeroTitle,
    type TransactionDetailSummary,
} from '@modules/signing'
import type { RootStackParamList } from '@routes/types'
import {
    toGroupTransactionRows,
    type GroupTransactionRow,
} from '../../utils/groupTransactionRows'

type NavigationProp = NativeStackNavigationProp<
    RootStackParamList,
    'GroupTransactionList'
>
type ScreenRouteProp = RouteProp<RootStackParamList, 'GroupTransactionList'>

type UseGroupTransactionListScreenResult = {
    /** Set when opened from a history row, such as a swap, so the list keeps the row's hero. */
    hero: Optional<TransactionDetailSummary>
    transactions: GroupTransactionRow[]
    isLoading: boolean
    isError: boolean
    handleTransactionPress: (row: GroupTransactionRow) => void
    keyExtractor: (item: GroupTransactionRow, index: number) => string
}

export const useGroupTransactionListScreen =
    (): UseGroupTransactionListScreenResult => {
        const navigation = useNavigation<NavigationProp>()
        const route = useRoute<ScreenRouteProp>()
        const { groupId, historyTransaction } = route.params
        const scope = useSelectedScope(LEGACY_CHAIN_ID)
        const heroTitle = useTransactionHeroTitle()
        const account = useSelectedAccount()
        const address = account
            ? (chainAccountOf(account, scope.chainId)?.address ?? '')
            : ''

        const summary = useMemo(
            () =>
                historyTransaction
                    ? summarizeHistoryItem(
                          historyTransaction,
                          address,
                          scope.chainId,
                      )
                    : undefined,
            [historyTransaction, address, scope.chainId],
        )
        const amountAssetId = summary?.amount?.assetRef.assetId
        const { data: storedAssets, isPending: isAssetPending } =
            useAssetsQuery(scope, amountAssetId ? [amountAssetId] : [], {
                fetchMissing: true,
            })
        const amountAsset = amountAssetId
            ? storedAssets.get(amountAssetId)
            : undefined

        const hero = useMemo((): Optional<TransactionDetailSummary> => {
            if (!summary || !historyTransaction) return undefined
            const { status } = historyTransaction
            return {
                scope,
                iconName: transactionIconName(summary.icon),
                title: heroTitle(summary.title),
                status:
                    status === 'pending' || status === 'failed'
                        ? status
                        : 'completed',
                amount:
                    summary.amount && amountAsset
                        ? {
                              asset: amountAsset,
                              value: baseUnitsToDisplayUnits(
                                  summary.amount.value,
                                  amountAsset.decimals,
                              ),
                          }
                        : undefined,
                isAmountLoading: !!summary.amount && isAssetPending,
            }
        }, [
            summary,
            historyTransaction,
            scope,
            heroTitle,
            amountAsset,
            isAssetPending,
        ])

        const { groupTransactions, isLoading, isError } =
            useGroupTransactionsQuery({ groupId })
        const transactions = useMemo(
            () => toGroupTransactionRows(groupTransactions),
            [groupTransactions],
        )

        const handleTransactionPress = useCallback(
            (row: GroupTransactionRow) => {
                navigation.navigate('TransactionDetails', {
                    scope,
                    transaction: row.native,
                    groupId,
                })
            },
            [navigation, scope, groupId],
        )

        const keyExtractor = useCallback(
            (item: GroupTransactionRow, index: number) =>
                item.view.id ?? `tx-${index}`,
            [],
        )

        return {
            hero,
            transactions,
            isLoading,
            isError,
            handleTransactionPress,
            keyExtractor,
        }
    }
