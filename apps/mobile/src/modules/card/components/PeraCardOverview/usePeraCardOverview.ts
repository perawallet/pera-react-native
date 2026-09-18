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
import {
    AUTO_FUNDING_PER_TX_LIMIT_USD,
    DEFAULT_CARD_CURRENCY,
    CardWalletKind,
    useCardExternalWalletsQuery,
    useCardStore,
    useCardWalletBalanceQuery,
    useCardTransactionsQuery,
} from '@perawallet/wallet-core-card'
import {
    useAccountAssetBalanceQuery,
    useSelectedAccountAddress,
} from '@perawallet/wallet-core-accounts'
import { getKnownAssetId } from '@perawallet/wallet-core-assets'
import { useNetwork } from '@perawallet/wallet-core-blockchain'
import type { Nullable } from '@perawallet/wallet-core-shared'
import { trackEvent, CardEvent } from '@analytics'
import { useAppNavigation } from '@hooks/useAppNavigation'
import { USDC_RAMP_TOKEN_ID } from '@modules/onramp/constants'
import { CARD_WALLET_PRESENTATION } from '../../utils/cardWalletPresentation'
import {
    useCardEscrowBalance,
    useCardFundingAccount,
    useIsCardAutoFundingActive,
} from '../../hooks'
import {
    usePeraCardPendingWithdrawal,
    type PendingWithdrawalView,
} from './usePeraCardPendingWithdrawal'
import {
    groupCardTransactionsByMonth,
    type CardTransactionSection,
} from '../../utils/cardTransactions'

export type PeraCardCredits = {
    rewards: Decimal
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
    /** Open timelocked withdrawal, if any; the overview hosts its Complete and Cancel steps. */
    pendingWithdrawal: Nullable<PendingWithdrawalView>
    onWithdraw: () => void
    onCompleteWithdrawal: () => void
    onCancelWithdrawal: () => void
    onAddFunds: () => void
    /** Auto funding: top up the linked account itself, via the Fund tab. */
    onFundLinkedAccount: () => void
    onShowAllTransactions: () => void
    onPressTransaction: (transactionId: string) => void
    onCreditPress: (kind: CardWalletKind) => void
}

export const usePeraCardOverview = (): UsePeraCardOverviewResult => {
    // Reaches both the Home tab's card screens and the root-stack money flows,
    // so it needs the app-wide navigation type rather than one param list.
    const navigation = useAppNavigation()
    const { network } = useNetwork()
    const connectedAddress = useCardStore(
        state => state.connectedFundingSourceAddress,
    )
    const isAutoFunding = useIsCardAutoFundingActive()
    const { transactions, isLoading } = useCardTransactionsQuery()

    const transactionSections = useMemo(
        () => groupCardTransactionsByMonth(transactions),
        [transactions],
    )

    const { balance: cardBalance, isLoading: isCardBalanceLoading } =
        useCardEscrowBalance()
    // Only the allowance is taken from Baanx; both balances are read from the
    // chain, which is the only source Pera's platform is served. Manual funding
    // has no delegation at all, so asking for one is a guaranteed failure.
    const { delegatedWallet } = useCardExternalWalletsQuery({
        address: connectedAddress,
        enabled: isAutoFunding,
    })

    // Auto funding never moves USDC onto the card: it is drawn from the linked
    // account at spend time, so that account's own holding is the spendable
    // figure. Reading it from the chain also keeps it right on platforms Baanx
    // does not serve wallet balances to.
    const fundingAccount = useCardFundingAccount()
    const usdcAssetId = useMemo(
        () => getKnownAssetId('USDC', network),
        [network],
    )
    const { data: linkedUsdc, isPending: isLinkedBalancePending } =
        useAccountAssetBalanceQuery(
            isAutoFunding ? (fundingAccount ?? undefined) : undefined,
            usdcAssetId ?? undefined,
        )
    const canReadLinkedBalance =
        isAutoFunding && fundingAccount != null && usdcAssetId !== null

    // Both live in their own Baanx wallets, null until something is credited.
    const { wallet: rewardWallet } = useCardWalletBalanceQuery(
        CardWalletKind.Reward,
    )
    const { wallet: creditWallet } = useCardWalletBalanceQuery(
        CardWalletKind.Credit,
    )
    const credits = useMemo<PeraCardCredits>(
        () => ({
            rewards: rewardWallet?.balance ?? ZERO_BALANCE,
            refunds: creditWallet?.balance ?? ZERO_BALANCE,
        }),
        [rewardWallet, creditWallet],
    )

    const linkedBalance = canReadLinkedBalance
        ? (linkedUsdc?.amount ?? ZERO_BALANCE)
        : ZERO_BALANCE

    // Baanx enforces the delegation allowance per transaction; fall back to
    // the app constant until the server reports one.
    const perTxLimit = delegatedWallet?.allowance.gt(0)
        ? delegatedWallet.allowance
        : AUTO_FUNDING_PER_TX_LIMIT_USD

    // Baanx draws the refund (credit) balance first on a card purchase, so it
    // counts. Rewards do not: that wallet has to be claimed before it can be
    // spent, so counting it would promise more than the card can draw.
    const spendablePerTx = (
        isAutoFunding ? Decimal.min(perTxLimit, linkedBalance) : ZERO_BALANCE
    )
        .plus(cardBalance)
        .plus(credits.refunds)

    const { setSelectedAccountAddress } = useSelectedAccountAddress()
    const { pendingWithdrawal, onCompleteWithdrawal, onCancelWithdrawal } =
        usePeraCardPendingWithdrawal()

    const onAddFunds = useCallback(() => {
        trackEvent(CardEvent.HomeAddFunds)
        navigation.navigate('CardAddFunds')
    }, [navigation])

    const onWithdraw = useCallback(() => {
        trackEvent(CardEvent.HomeWithdraw)
        navigation.navigate('CardWithdraw')
    }, [navigation])

    const onFundLinkedAccount = useCallback(() => {
        if (fundingAccount === null) return
        trackEvent(CardEvent.HomeGetUsdc)
        // The Fund tab works on the selected account, so make it the linked
        // one first or the USDC lands wherever the user last was.
        setSelectedAccountAddress(fundingAccount.address)
        navigation.navigate('TabBar', {
            screen: 'Fund',
            params: { destinationTokenId: USDC_RAMP_TOKEN_ID },
        })
    }, [fundingAccount, setSelectedAccountAddress, navigation])

    const onShowAllTransactions = useCallback(() => {
        trackEvent(CardEvent.HomeShowAll)
        navigation.navigate('CardTransactions')
    }, [navigation])

    const onPressTransaction = useCallback(
        (transactionId: string) => {
            navigation.navigate('CardTransactionDetail', { id: transactionId })
        },
        [navigation],
    )

    const onCreditPress = useCallback(
        (kind: CardWalletKind) => {
            trackEvent(CARD_WALLET_PRESENTATION[kind].homeEvent)
            navigation.navigate('CardWalletBalance', { kind })
        },
        [navigation],
    )

    return {
        isAutoFunding,
        currency: DEFAULT_CARD_CURRENCY,
        balance: cardBalance.plus(linkedBalance),
        spendablePerTx,
        isBalanceLoading:
            isCardBalanceLoading ||
            (canReadLinkedBalance && isLinkedBalancePending),
        credits,
        transactionSections,
        isLoadingTransactions: isLoading,
        pendingWithdrawal,
        onWithdraw,
        onCompleteWithdrawal,
        onCancelWithdrawal,
        onAddFunds,
        onFundLinkedAccount,
        onShowAllTransactions,
        onPressTransaction,
        onCreditPress,
    }
}
