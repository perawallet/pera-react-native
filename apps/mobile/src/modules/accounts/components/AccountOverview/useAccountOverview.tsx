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

import { useCallback, useEffect, useMemo, useState } from 'react'
import {
    useAccountBalancesHistoryQuery,
    useAccountBalancesQuery,
    useSelectedAccount,
    WalletAccount,
} from '@perawallet/wallet-core-accounts'
import { HistoryPeriod } from '@perawallet/wallet-core-shared'
import { useBottomSheet } from '@modules/bottom-sheet'
import { ReceiveFundsContent } from '@modules/transactions/components/receive-funds/ReceiveFundsContent'
import { SendFundsContent } from '@modules/transactions/components/send-funds/SendFundsContent'
import { useReceiveFunds } from '@modules/transactions/hooks'
import { AccountOptionsContent } from '../AccountOptionsContent'
import { UseAccountOverviewModalResult } from './AccountOverviewModalContext'

// Matches the default in useChartInteraction so balances + history queries
// share keys with the header's chart and we don't double-fetch.
const INITIAL_HISTORY_PERIOD: HistoryPeriod = 'one-week'

export type UseAccountOverviewParams = {
    account: WalletAccount
    onSwipeEnabledChange?: (enabled: boolean) => void
}

export type UseAccountOverviewResult = {
    openSendFunds: () => void
    openReceiveFunds: () => void
    openAccountOptions: () => void
    scrollingEnabled: boolean
    onScrollEnabledChange: (enabled: boolean) => void
    isLoading: boolean
    contextValue: UseAccountOverviewModalResult
}

export const useAccountOverview = ({
    account,
    onSwipeEnabledChange,
}: UseAccountOverviewParams): UseAccountOverviewResult => {
    const selectedAccount = useSelectedAccount()
    const { setSelectedAccount, setCanSelectAccount } = useReceiveFunds()
    const { request: requestBottomSheet } = useBottomSheet()

    const openSendFunds = useCallback(() => {
        void requestBottomSheet({
            contents: <SendFundsContent />,
            options: {
                size: 'modal',
                enablePanDownToClose: false,
                autoCreateContainer: false,
            },
        })
    }, [requestBottomSheet])

    const openReceiveFunds = useCallback(() => {
        if (selectedAccount) {
            setCanSelectAccount(false)
            setSelectedAccount(selectedAccount)
        }
        void requestBottomSheet({
            contents: <ReceiveFundsContent account={account} />,
            options: {
                size: 'modal',
                enablePanDownToClose: true,
                autoCreateContainer: false,
            },
        })
    }, [
        account,
        requestBottomSheet,
        selectedAccount,
        setCanSelectAccount,
        setSelectedAccount,
    ])

    const openAccountOptions = useCallback(() => {
        void requestBottomSheet({
            contents: (
                <AccountOptionsContent
                    account={account}
                    onShowAddress={openReceiveFunds}
                />
            ),
            options: {
                size: 'modal',
                enablePanDownToClose: true,
                autoCreateContainer: false,
            },
        })
    }, [requestBottomSheet, account, openReceiveFunds])

    const [scrollingEnabled, setScrollingEnabled] = useState<boolean>(true)

    useEffect(() => {
        onSwipeEnabledChange?.(scrollingEnabled)
    }, [scrollingEnabled, onSwipeEnabledChange])

    // Combine balance + history pending into one sticky `isLoading` flag so the
    // skeleton header reveals as a single beat and doesn't reappear when the
    // user later changes period.
    const { isPending: isBalancesPending } = useAccountBalancesQuery(
        account ? [account] : [],
    )
    const { isPending: isHistoryPending } = useAccountBalancesHistoryQuery(
        account ? [account.address] : [],
        INITIAL_HISTORY_PERIOD,
    )
    const [hasCompletedInitialLoad, setHasCompletedInitialLoad] =
        useState(false)
    useEffect(() => {
        if (
            !hasCompletedInitialLoad &&
            !isBalancesPending &&
            !isHistoryPending
        ) {
            setHasCompletedInitialLoad(true)
        }
    }, [hasCompletedInitialLoad, isBalancesPending, isHistoryPending])
    const isLoading = !hasCompletedInitialLoad

    const contextValue = useMemo<UseAccountOverviewModalResult>(
        () => ({
            account,
            openSendFunds,
            openReceiveFunds,
            openAccountOptions,
            onScrollEnabledChange: setScrollingEnabled,
        }),
        [account, openSendFunds, openReceiveFunds, openAccountOptions],
    )

    return {
        openSendFunds,
        openReceiveFunds,
        openAccountOptions,
        scrollingEnabled,
        onScrollEnabledChange: setScrollingEnabled,
        isLoading,
        contextValue,
    }
}
