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
import { usePreferences, useSettings } from '@perawallet/wallet-core-settings'
import { UserPreferences } from '@constants/user-preferences'
import { useChartInteraction } from '@hooks/useChartInteraction'
import { HistoryPeriod } from '@perawallet/wallet-core-shared'
import { ParamListBase, useNavigation } from '@react-navigation/native'
import { NativeStackNavigationProp } from '@react-navigation/native-stack'
import { useLanguage } from '@hooks/useLanguage'
import { useToast } from '@hooks/useToast'

export type UseAccountOverviewResult = {
    portfolioAlgoValue: Decimal
    portfolioFiatValue: Decimal
    isPending: boolean
    period: HistoryPeriod
    setPeriod: (period: HistoryPeriod) => void
    selectedPoint: AccountBalanceHistoryItem | null
    chartVisible: boolean
    scrollingEnabled: boolean
    preferredCurrency: string
    hasBalance: boolean
    togglePrivacyMode: () => void
    toggleChartVisible: () => void
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
    handleTransfer: () => void
    handleReceive: () => void
}

export const useAccountOverview = (
    account: WalletAccount,
): UseAccountOverviewResult => {
    const { preferredCurrency } = useCurrency()
    const { portfolioAlgoValue, portfolioFiatValue, isPending } =
        useAccountBalancesQuery(account ? [account] : [])
    const { getPreference, setPreference } = usePreferences()
    const { period, setPeriod, selectedPoint, setSelectedPoint } =
        useChartInteraction<AccountBalanceHistoryItem>()
    const [scrollingEnabled, setScrollingEnabled] = useState<boolean>(true)
    const { privacyMode, setPrivacyMode } = useSettings()

    const togglePrivacyMode = useCallback(() => {
        setPrivacyMode(!privacyMode)
    }, [privacyMode, setPrivacyMode])

    const chartVisible = !!getPreference(UserPreferences.chartVisible)
    const toggleChartVisible = useCallback(() => {
        setPreference(UserPreferences.chartVisible, !chartVisible)
    }, [chartVisible, setPreference])

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

    const navigation = useNavigation<NativeStackNavigationProp<ParamListBase>>()
    const { t } = useLanguage()
    const { showToast } = useToast()
    const [isSendFundsVisible, setIsSendFundsVisible] = useState(false)

    const handleOpenSendFunds = useCallback(() => {
        setIsSendFundsVisible(true)
    }, [])

    const handleCloseSendFunds = useCallback(() => {
        setIsSendFundsVisible(false)
    }, [])

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
        notImplemented()
    }, [notImplemented])

    const handleTransfer = useCallback(() => {
        notImplemented()
    }, [notImplemented])

    const handleReceive = useCallback(() => {
        notImplemented()
    }, [notImplemented])

    return {
        portfolioAlgoValue,
        portfolioFiatValue,
        isPending,
        period,
        setPeriod,
        selectedPoint,
        chartVisible,
        scrollingEnabled,
        preferredCurrency,
        hasBalance: portfolioAlgoValue.gt(0),
        togglePrivacyMode,
        toggleChartVisible,
        handleChartSelectionChange,
        isSendFundsVisible,
        handleOpenSendFunds,
        handleCloseSendFunds,
        handleSwap,
        handleStake,
        handleMore: notImplemented,
        handleBuyAlgo,
        handleTransfer,
        handleReceive,
    }
}
