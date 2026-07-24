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
import { Decimal } from 'decimal.js'
import { useNavigation } from '@react-navigation/native'
import { type NativeStackNavigationProp } from '@react-navigation/native-stack'
import {
    AUTO_FUNDING_PER_TX_LIMIT_USD,
    DEFAULT_CARD_CURRENCY,
    FundingType,
    OnboardingStep,
    useCardExternalWalletsQuery,
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
    /** On-card balance, plus the linked account's balance when auto-funding. */
    balance: Decimal
    /** Max a single purchase can draw: card balance + credits, plus (with
     * auto-funding) min(per-tx limit, linked account balance). */
    spendablePerTx: Decimal
    isBalanceLoading: boolean
    credits: PeraCardCredits
    transactionSections: CardTransactionSection[]
    isLoadingTransactions: boolean
    onWithdraw: () => void
    onAddFunds: () => void
    onGetUsdc: () => void
    onShowAllTransactions: () => void
    onPressTransaction: (transactionId: string) => void
    onCreditPress: () => void
    /** Dev-only shortcut back to the setup checklist, for testing onboarding. */
    onDebugGoToOnboarding: () => void
}

export const usePeraCardOverview = (): UsePeraCardOverviewResult => {
    const navigation =
        useNavigation<NativeStackNavigationProp<PeraCardStackParamList>>()
    const selectedFundingType = useCardStore(state => state.selectedFundingType)
    const connectedAddress = useCardStore(
        state => state.connectedFundingSourceAddress,
    )
    const isAutoFunding = selectedFundingType === FundingType.Auto
    const { transactions, isLoading } = useCardTransactionsQuery()

    const transactionSections = useMemo(
        () => groupCardTransactionsByMonth(transactions),
        [transactions],
    )

    const { usdcWallet, isLoading: isCardBalanceLoading } =
        useCardInternalWalletsQuery()
    const { delegatedWallet, isLoading: isLinkedBalanceLoading } =
        useCardExternalWalletsQuery({ address: connectedAddress })

    // TODO(card): credits are stubbed — no Baanx API exposes them yet.
    const credits = useMemo<PeraCardCredits>(
        () => ({ cashbacks: new Decimal(0), refunds: new Decimal(0) }),
        [],
    )

    const cardBalance = usdcWallet?.balance ?? ZERO_BALANCE
    const linkedBalance = isAutoFunding
        ? (delegatedWallet?.balance ?? ZERO_BALANCE)
        : ZERO_BALANCE

    // Baanx enforces the delegation allowance per transaction; fall back to
    // the app constant until the server reports one.
    const perTxLimit = delegatedWallet?.allowance.gt(0)
        ? delegatedWallet.allowance
        : AUTO_FUNDING_PER_TX_LIMIT_USD

    const creditsTotal = credits.cashbacks.plus(credits.refunds)
    const spendablePerTx = (
        isAutoFunding ? Decimal.min(perTxLimit, linkedBalance) : ZERO_BALANCE
    )
        .plus(cardBalance)
        .plus(creditsTotal)

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
            navigation.navigate('CardTransactionDetail', { id: transactionId })
        },
        [navigation],
    )

    // Dev-only: the account-menu routes straight to this dashboard whenever a
    // Baanx session exists, regardless of whether onboarding actually
    // finished (PERA card TODO — see CardFundingAccountSection). This
    // shortcut lets a developer get back to the setup checklist to test the
    // connect/create-card flow without clearing app state.
    const onDebugGoToOnboarding = useCallback(() => {
        // DEBUG ONLY: force past registration locally so Connect Funds/Create
        // Card show up regardless of whatever the local onboarding state is —
        // there's no real reconciliation path for an already-approved Baanx
        // account whose local state was lost, so this stands in for one.
        useCardStore.getState().setOnboardingStep(OnboardingStep.Completed)
        navigation.navigate('CardOnboarding', {
            screen: 'CardOnboardingStatus',
            params: {},
        })
    }, [navigation])

    return {
        isAutoFunding,
        currency: DEFAULT_CARD_CURRENCY,
        balance: cardBalance.plus(linkedBalance),
        spendablePerTx,
        isBalanceLoading:
            isCardBalanceLoading || (isAutoFunding && isLinkedBalanceLoading),
        credits,
        transactionSections,
        isLoadingTransactions: isLoading,
        onWithdraw,
        onAddFunds,
        onGetUsdc: showComingSoon,
        onShowAllTransactions,
        onPressTransaction,
        onCreditPress: showComingSoon,
        onDebugGoToOnboarding,
    }
}
