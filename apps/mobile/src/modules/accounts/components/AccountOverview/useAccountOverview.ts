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

import { useCallback, useMemo, useState } from 'react'
import Decimal from 'decimal.js'
import {
    AccountBalanceHistoryItem,
    useAccountBalancesQuery,
    usePortfolioTotals,
    useSelectedAccount,
    WalletAccount,
} from '@perawallet/wallet-core-accounts'
import { useCurrency } from '@perawallet/wallet-core-currencies'
import { useSettings } from '@perawallet/wallet-core-settings'
import { useChartInteraction } from '@hooks/useChartInteraction'
import { HistoryPeriod } from '@perawallet/wallet-core-shared'
import { useAppNavigation } from '@hooks/useAppNavigation'
import { useModalState } from '@hooks/useModalState'
import { useReceiveFunds } from '@modules/transactions/hooks'
import { useClipboard } from '@hooks/useClipboard'
import { useToast } from '@hooks/useToast'
import { useLanguage } from '@hooks/useLanguage'

export type UseAccountOverviewResult = {
    portfolioAlgoValue: Decimal
    portfolioPreferredValue: Decimal
    isPending: boolean
    period: HistoryPeriod
    setPeriod: (period: HistoryPeriod) => void
    selectedPoint: AccountBalanceHistoryItem | null
    scrollingEnabled: boolean
    preferredCurrency: string
    hasBalance: boolean
    togglePrivacyMode: () => void
    handleChartSelectionChange: (
        selected: AccountBalanceHistoryItem | null,
    ) => void
    isSendFundsVisible: boolean
    handleOpenSendFunds: () => void
    handleCloseSendFunds: () => void
    handleSwap: () => void
    handleMore: () => void
    handleBuyAlgo: () => void
    handleReceive: () => void
    handleCopyAddress: () => void
    handleShowQR: () => void
    isReceiveFundsVisible: boolean
    handleCloseReceiveFunds: () => void
    isAccountOptionsVisible: boolean
    handleCloseAccountOptions: () => void
}

export const useAccountOverview = (
    account: WalletAccount,
): UseAccountOverviewResult => {
    const { preferredCurrency, usdToPreferred } = useCurrency()
    const { portfolioAlgoValue, accountBalances, isPending } =
        useAccountBalancesQuery(account ? [account] : [])
    const { portfolioUsdValue } = usePortfolioTotals(accountBalances)
    const portfolioPreferredValue = useMemo(
        () => usdToPreferred(portfolioUsdValue),
        [usdToPreferred, portfolioUsdValue],
    )
    const { period, setPeriod, selectedPoint, setSelectedPoint } =
        useChartInteraction<AccountBalanceHistoryItem>()
    const [scrollingEnabled, setScrollingEnabled] = useState<boolean>(true)
    const { privacyMode, setPrivacyMode } = useSettings()
    const selectedAccount = useSelectedAccount()
    const { setSelectedAccount, setCanSelectAccount } = useReceiveFunds()

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
    const {
        isOpen: isSendFundsVisible,
        open: handleOpenSendFunds,
        close: handleCloseSendFunds,
    } = useModalState()

    const handleSwap = useCallback(() => {
        navigation.replace('TabBar', { screen: 'Swap' })
    }, [navigation])

    const handleBuyAlgo = useCallback(() => {
        navigation.navigate('TabBar', { screen: 'Fund' })
    }, [navigation])

    const {
        isOpen: isReceiveFundsVisible,
        open: handleOpenReceiveFunds,
        close: handleCloseReceiveFunds,
    } = useModalState()

    const {
        isOpen: isAccountOptionsVisible,
        open: handleOpenAccountOptions,
        close: handleCloseAccountOptions,
    } = useModalState()

    const handleReceive = useCallback(() => {
        if (selectedAccount) {
            setCanSelectAccount(false)
            setSelectedAccount(selectedAccount)
        }
        handleOpenReceiveFunds()
    }, [selectedAccount, handleOpenReceiveFunds])

    const handleMore = useCallback(() => {
        handleOpenAccountOptions()
    }, [handleOpenAccountOptions])

    const { copyToClipboard } = useClipboard()
    const { showToast } = useToast()
    const { t } = useLanguage()

    const handleCopyAddress = useCallback(() => {
        copyToClipboard(account.address)
        showToast({
            title: t('account_options.copy_address'),
            body: '',
            type: 'success',
        })
    }, [copyToClipboard, account.address, showToast, t])

    const handleShowQR = useCallback(() => {
        if (selectedAccount) {
            setCanSelectAccount(false)
            setSelectedAccount(selectedAccount)
        }
        handleOpenReceiveFunds()
    }, [
        selectedAccount,
        handleOpenReceiveFunds,
        setCanSelectAccount,
        setSelectedAccount,
    ])

    return {
        portfolioAlgoValue,
        portfolioPreferredValue,
        isPending,
        period,
        setPeriod,
        selectedPoint,
        scrollingEnabled,
        preferredCurrency,
        hasBalance: portfolioAlgoValue.gt(0),
        togglePrivacyMode,
        handleChartSelectionChange,
        isSendFundsVisible,
        handleOpenSendFunds,
        handleCloseSendFunds,
        handleSwap,
        handleMore,
        handleBuyAlgo,
        handleReceive,
        handleCopyAddress,
        handleShowQR,
        isReceiveFundsVisible,
        handleCloseReceiveFunds,
        isAccountOptionsVisible,
        handleCloseAccountOptions,
    }
}
