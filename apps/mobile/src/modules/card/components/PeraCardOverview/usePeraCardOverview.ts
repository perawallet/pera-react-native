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
    DEFAULT_CARD_CURRENCY,
    CardWalletKind,
    useCardWalletBalanceQuery,
    useCardTransactionsQuery,
} from '@perawallet/wallet-core-card'
import {
    useAccountAssetBalanceQuery,
    useSelectedAccountAddress,
} from '@perawallet/wallet-core-accounts'
import { getKnownAssetId, useNativeAsset } from '@perawallet/wallet-core-assets'
import { scopeForLegacyNetwork } from '@perawallet/wallet-core-chain-contract'
import { useNetwork } from '@perawallet/wallet-core-chain-shared'
import { trackEvent, CardEvent } from '@analytics'
import { useAppNavigation } from '@hooks/useAppNavigation'
import { useLanguage } from '@hooks/useLanguage'
import { useCapability } from '@hooks/useCapability'
import { USDC_RAMP_TOKEN_ID } from '@modules/onramp'
import { CARD_WALLET_PRESENTATION } from '../../utils/cardWalletPresentation'
import {
    useCardEscrowBalance,
    useCardFundingAccount,
    useIsCardAutoFundingActive,
    useCardWithdraw,
} from '../../hooks'
// Imported directly (not via the hooks barrel) to avoid an import cycle: it
// pulls in a sheet component that imports from that barrel.
import { useOpenFundingTypeSheet } from '../../hooks/useOpenFundingTypeSheet'
import {
    groupCardTransactionsByMonth,
    type CardTransactionSection,
} from '../../utils/cardTransactions'

export type PeraCardCredits = {
    rewards: Decimal
    refunds: Decimal
}

const ZERO_BALANCE = new Decimal(0)

export type CardWithdrawState = 'idle' | 'waiting' | 'ready'

type UsePeraCardOverviewResult = {
    isAutoFunding: boolean
    /** Localised "Auto/Manual Funding enabled" status shown under the balance. */
    fundingTypeLabel: string
    onChangeFundingType: () => void
    currency: string
    /** On-card balance, plus the linked account's balance when auto-funding. */
    balance: Decimal
    isBalanceLoading: boolean
    credits: PeraCardCredits
    transactionSections: CardTransactionSection[]
    isLoadingTransactions: boolean
    /** Open timelocked withdrawal, if any; the overview hosts its Complete and Cancel steps. */
    /** Idle opens the form; the other two lead to the open request. */
    withdrawState: CardWithdrawState
    onWithdraw: () => void
    onAddFunds: () => void
    /** Auto funding: top up the linked account itself, via the Fund tab. */
    onFundLinkedAccount: () => void
    /** Funding the linked account needs a swap or a purchase; with neither the button is removed. */
    canFundLinkedAccount: boolean
    onShowAllTransactions: () => void
    onPressTransaction: (transactionId: string) => void
    onCreditPress: (kind: CardWalletKind) => void
}

export const usePeraCardOverview = (): UsePeraCardOverviewResult => {
    // Reaches both the Home tab's card screens and the root-stack money flows,
    // so it needs the app-wide navigation type rather than one param list.
    const navigation = useAppNavigation()
    const { network } = useNetwork()
    const nativeAsset = useNativeAsset()
    const { t } = useLanguage()
    const isAutoFunding = useIsCardAutoFundingActive()
    const fundingTypeLabel = isAutoFunding
        ? t('peraCard.account.funding_type_enabled_auto')
        : t('peraCard.account.funding_type_enabled_manual')
    const onChangeFundingType = useOpenFundingTypeSheet()
    const canSwap = useCapability({ anyChain: 'swap' })
    const canBuy = useCapability({ anyChain: 'onramp' })
    const { transactions, isLoading } = useCardTransactionsQuery()

    const transactionSections = useMemo(
        () => groupCardTransactionsByMonth(transactions),
        [transactions],
    )

    const { balance: cardBalance, isLoading: isCardBalanceLoading } =
        useCardEscrowBalance()
    // Auto funding never moves USDC onto the card: it is drawn from the linked
    // account at spend time, so that account's own holding is the spendable
    // figure. Reading it from the chain also keeps it right on platforms Baanx
    // does not serve wallet balances to.
    const fundingAccount = useCardFundingAccount()
    const usdcAssetId = useMemo(
        () => getKnownAssetId('USDC', scopeForLegacyNetwork(network)),
        [network],
    )
    const { data: linkedUsdc, isPending: isLinkedBalancePending } =
        useAccountAssetBalanceQuery(
            isAutoFunding ? (fundingAccount ?? undefined) : undefined,
            usdcAssetId ?? undefined,
        )
    const canReadLinkedBalance =
        isAutoFunding && fundingAccount != null && usdcAssetId !== null
    // Only whether the linked account holds ALGO matters: it decides whether
    // Add Funds can swap into USDC or has to buy it.
    const { data: linkedAlgo } = useAccountAssetBalanceQuery(
        isAutoFunding ? (fundingAccount ?? undefined) : undefined,
        nativeAsset.assetId,
    )
    const hasLinkedAlgo =
        canReadLinkedBalance && (linkedAlgo?.amount.gt(0) ?? false)
    const canSwapToUsdc = hasLinkedAlgo && canSwap
    const canFundLinkedAccount = canSwapToUsdc || canBuy

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

    const balance = cardBalance.plus(linkedBalance)

    const { setSelectedAccountAddress } = useSelectedAccountAddress()
    const { pending: pendingWithdrawal, isReady: isWithdrawReady } =
        useCardWithdraw()
    const withdrawState: CardWithdrawState =
        pendingWithdrawal === null
            ? 'idle'
            : isWithdrawReady
              ? 'ready'
              : 'waiting'

    const onAddFunds = useCallback(() => {
        trackEvent(CardEvent.HomeAddFunds)
        navigation.navigate('CardAddFunds')
    }, [navigation])

    const onWithdraw = useCallback(() => {
        trackEvent(CardEvent.HomeWithdraw)
        // One request at a time: while one is open the button leads to it.
        navigation.navigate(
            pendingWithdrawal === null ? 'CardWithdraw' : 'CardWithdrawStatus',
        )
    }, [navigation, pendingWithdrawal])

    const onFundLinkedAccount = useCallback(() => {
        if (fundingAccount === null || !canFundLinkedAccount) return
        trackEvent(CardEvent.HomeGetUsdc)
        // Both tabs work on the selected account, so make it the linked one
        // first or the USDC lands wherever the user last was.
        setSelectedAccountAddress(fundingAccount.address)
        if (canSwapToUsdc) {
            navigation.navigate('TabBar', {
                screen: 'Swap',
                params: {
                    assetInId: nativeAsset.assetId,
                    assetOutId: usdcAssetId ?? undefined,
                },
            })
            return
        }
        navigation.navigate('TabBar', {
            screen: 'Fund',
            params: { destinationTokenId: USDC_RAMP_TOKEN_ID },
        })
    }, [
        fundingAccount,
        canFundLinkedAccount,
        canSwapToUsdc,
        nativeAsset.assetId,
        usdcAssetId,
        setSelectedAccountAddress,
        navigation,
    ])

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
        fundingTypeLabel,
        onChangeFundingType,
        currency: DEFAULT_CARD_CURRENCY,
        balance,
        isBalanceLoading:
            isCardBalanceLoading ||
            (canReadLinkedBalance && isLinkedBalancePending),
        credits,
        transactionSections,
        isLoadingTransactions: isLoading,
        withdrawState,
        onWithdraw,
        onAddFunds,
        onFundLinkedAccount,
        canFundLinkedAccount,
        onShowAllTransactions,
        onPressTransaction,
        onCreditPress,
    }
}
