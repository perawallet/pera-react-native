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

import { useCallback, useState } from 'react'
import Decimal from 'decimal.js'
import {
    AccountBalanceHistoryItem,
    useAccountBalancesQuery,
    WalletAccount,
} from '@perawallet/wallet-core-accounts'
import { useCurrency } from '@perawallet/wallet-core-currencies'
import { useSettings } from '@perawallet/wallet-core-settings'
import { useChartInteraction } from '@hooks/useChartInteraction'
import { HistoryPeriod } from '@perawallet/wallet-core-shared'
import { useAppNavigation } from '@hooks/useAppNavigation'
import { useLanguage } from '@hooks/useLanguage'
import { useToast } from '@hooks/useToast'
import { useModalState } from '@hooks/useModalState'

export type UseAccountOverviewResult = {
    portfolioAlgoValue: Decimal
    portfolioFiatValue: Decimal
    isPending: boolean
    period: HistoryPeriod
    setPeriod: (period: HistoryPeriod) => void
    selectedPoint: AccountBalanceHistoryItem | null
    scrollingEnabled: boolean
    preferredFiatCurrency: string
    hasBalance: boolean
    togglePrivacyMode: () => void
    handleChartSelectionChange: (
        selected: AccountBalanceHistoryItem | null,
    ) => void
    isSendFundsVisible: boolean
    handleOpenSendFunds: () => void
    handleCloseSendFunds: () => void
    handleSwap: () => void
    handleStake: () => void
    handleMore: () => void
    handleBuyAlgo: () => void
    handleReceive: () => void
    isReceiveFundsVisible: boolean
    handleCloseReceiveFunds: () => void
}

export const useAccountOverview = (
    account: WalletAccount,
): UseAccountOverviewResult => {
    const { preferredFiatCurrency } = useCurrency()
    const { portfolioAlgoValue, portfolioFiatValue, isPending } =
        useAccountBalancesQuery(account ? [account] : [])
    const { period, setPeriod, selectedPoint, setSelectedPoint } =
        useChartInteraction<AccountBalanceHistoryItem>()
    const [scrollingEnabled, setScrollingEnabled] = useState<boolean>(true)
    const { privacyMode, setPrivacyMode } = useSettings()

    const togglePrivacyMode = useCallback(() => {
        setPrivacyMode(!privacyMode)
    }, [privacyMode, setPrivacyMode])

    const handleChartSelectionChange = useCallback(
        (selected: AccountBalanceHistoryItem | null) => {
            setSelectedPoint(selected)

            if (selected) {
                setScrollingEnabled(false)
            } else {
                setScrollingEnabled(true)
            }
        },
        [setSelectedPoint],
    )

    const navigation = useAppNavigation()
    const { t } = useLanguage()
    const { showToast } = useToast()
    const {
        isOpen: isSendFundsVisible,
        open: handleOpenSendFunds,
        close: handleCloseSendFunds,
    } = useModalState()

    const handleSwap = useCallback(() => {
        navigation.replace('TabBar', { screen: 'Swap' })
    }, [navigation])

    const handleStake = useCallback(() => {
        navigation.push('Staking')
    }, [navigation])

    const notImplemented = useCallback(() => {
        showToast({
            title: t('common.not_implemented.title'),
            body: t('common.not_implemented.body'),
            type: 'error',
        })
    }, [showToast, t])

    const handleBuyAlgo = useCallback(() => {
        navigation.navigate('TabBar', { screen: 'Fund' })
    }, [navigation])

    const {
        isOpen: isReceiveFundsVisible,
        open: handleOpenReceiveFunds,
        close: handleCloseReceiveFunds,
    } = useModalState()

    const handleReceive = useCallback(() => {
        handleOpenReceiveFunds()
    }, [handleOpenReceiveFunds])

    return {
        portfolioAlgoValue,
        portfolioFiatValue,
        isPending,
        period,
        setPeriod,
        selectedPoint,
        scrollingEnabled,
        preferredFiatCurrency,
        hasBalance: portfolioAlgoValue.gt(0),
        togglePrivacyMode,
        handleChartSelectionChange,
        isSendFundsVisible,
        handleOpenSendFunds,
        handleCloseSendFunds,
        handleSwap,
        handleStake,
        handleMore: notImplemented,
        handleBuyAlgo,
        handleReceive,
        isReceiveFundsVisible,
        handleCloseReceiveFunds,
    }
}
