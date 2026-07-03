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

import { useCallback, useMemo } from 'react'
import { Decimal } from 'decimal.js'
import { useNavigation } from '@react-navigation/native'
import { type NativeStackNavigationProp } from '@react-navigation/native-stack'
import {
    DEFAULT_CARD_CURRENCY,
    FundingType,
    useCardInternalWalletsQuery,
    useCardStore,
    useCardTransactionsQuery,
} from '@perawallet/wallet-core-card'
import { useCardComingSoonToast } from '../../hooks'
import { type PeraCardStackParamList } from '../../routes/types'
import {
    groupCardTransactionsByMonth,
    type CardTransactionSection,
} from '../../utils/cardTransactions'

type PeraCardCredits = {
    cashbacks: Decimal
    refunds: Decimal
}

const ZERO_BALANCE = new Decimal(0)

type UsePeraCardOverviewResult = {
    isAutoFunding: boolean
    currency: string
    balance: Decimal
    isBalanceLoading: boolean
    credits: PeraCardCredits
    transactionSections: CardTransactionSection[]
    isLoadingTransactions: boolean
    onFundingPress: () => void
    onWithdraw: () => void
    onAddFunds: () => void
    onGetUsdc: () => void
    onShowAllTransactions: () => void
    onPressTransaction: (transactionId: string) => void
    onCreditPress: () => void
}

export const usePeraCardOverview = (): UsePeraCardOverviewResult => {
    const navigation =
        useNavigation<NativeStackNavigationProp<PeraCardStackParamList>>()
    const selectedFundingType = useCardStore(state => state.selectedFundingType)
    const { transactions, isLoading } = useCardTransactionsQuery()

    const transactionSections = useMemo(
        () => groupCardTransactionsByMonth(transactions),
        [transactions],
    )

    const { usdcWallet, isLoading: isBalanceLoading } =
        useCardInternalWalletsQuery()
    const balance = usdcWallet?.balance ?? ZERO_BALANCE

    // TODO(card): credits are stubbed — no Baanx API exposes them yet.
    const credits = useMemo<PeraCardCredits>(
        () => ({ cashbacks: new Decimal(0), refunds: new Decimal(0) }),
        [],
    )

    const showComingSoon = useCardComingSoonToast()

    const onAddFunds = useCallback(() => {
        navigation.navigate('CardAddFunds')
    }, [navigation])

    const onWithdraw = useCallback(() => {
        navigation.navigate('CardWithdraw')
    }, [navigation])

    const onShowAllTransactions = useCallback(() => {
        navigation.navigate('CardTransactions')
    }, [navigation])

    const onPressTransaction = useCallback(
        (transactionId: string) => {
            navigation.navigate('CardTransactionDetail', { transactionId })
        },
        [navigation],
    )

    return {
        isAutoFunding: selectedFundingType === FundingType.Auto,
        currency: DEFAULT_CARD_CURRENCY,
        balance,
        isBalanceLoading,
        credits,
        transactionSections,
        isLoadingTransactions: isLoading,
        onFundingPress: showComingSoon,
        onWithdraw,
        onAddFunds,
        onGetUsdc: showComingSoon,
        onShowAllTransactions,
        onPressTransaction,
        onCreditPress: showComingSoon,
    }
}
