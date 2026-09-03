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

import { useCallback, useEffect, useMemo, useState } from 'react'
import {
    useAccountSummaryQuery,
    useEnsureAccountEnriched,
    useSelectedAccount,
    type WalletAccount,
} from '@perawallet/wallet-core-accounts'
import { useBottomSheet } from '@modules/bottom-sheet'
import { ReceiveFundsContent } from '@modules/transactions/components/receive-funds/ReceiveFundsContent'
import { SendFundsContent } from '@modules/transactions/components/send-funds/SendFundsContent'
import { useReceiveFunds } from '@modules/transactions/hooks'
import { useSyncRefresh } from '@hooks/useSyncRefresh'
import { trackEvent, HomeEvent, AccountDetailsEvent } from '@analytics'
import { AccountOptionsContent } from '../AccountOptionsContent'
import type { UseAccountOverviewModalResult } from './AccountOverviewModalContext'

export type UseAccountOverviewParams = {
    account: WalletAccount
}

export type UseAccountOverviewResult = {
    openSendFunds: () => void
    openReceiveFunds: () => void
    openAccountOptions: () => void
    isLoading: boolean
    isRefreshing: boolean
    handleRefresh: () => void
    contextValue: UseAccountOverviewModalResult
}

export const useAccountOverview = ({
    account,
}: UseAccountOverviewParams): UseAccountOverviewResult => {
    const selectedAccount = useSelectedAccount()
    const { setSelectedAccount, setCanSelectAccount } = useReceiveFunds()
    const { request: requestBottomSheet } = useBottomSheet()

    const openSendFunds = useCallback(() => {
        trackEvent(HomeEvent.Send)
        void requestBottomSheet({
            contents: <SendFundsContent />,
            options: {
                size: 'modal',
                enablePanDownToClose: false,
                enableCloseOnBackdropPress: false,
                autoCreateContainer: false,
            },
        })
    }, [requestBottomSheet])

    const openReceiveFunds = useCallback(() => {
        trackEvent(HomeEvent.Receive)
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
        trackEvent(AccountDetailsEvent.More)
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

    // Reveal the header as soon as the (cheap, SQL-aggregate) balance summary
    // resolves. The chart history is a separate, slower network query that's
    // gated on chart visibility — it must not hold the header in a skeleton
    // (and previously did, blocking ~10s on the wealth endpoint timeout).
    const { isPending: isBalancesPending } = useAccountSummaryQuery(
        account?.address,
    )
    // Guarantee the viewed account's holdings + metadata + prices are fetched
    // and enriched, regardless of the background poll's gating.
    useEnsureAccountEnriched(account?.address)
    const [hasCompletedInitialLoad, setHasCompletedInitialLoad] =
        useState(false)
    useEffect(() => {
        if (!hasCompletedInitialLoad && !isBalancesPending) {
            setHasCompletedInitialLoad(true)
        }
    }, [hasCompletedInitialLoad, isBalancesPending])
    const isLoading = !hasCompletedInitialLoad

    const refreshAddresses = useMemo(
        () => (account?.address ? [account.address] : []),
        [account?.address],
    )
    const { isRefreshing, refresh: handleRefresh } = useSyncRefresh({
        addresses: refreshAddresses,
    })

    const contextValue = useMemo<UseAccountOverviewModalResult>(
        () => ({
            account,
            openSendFunds,
            openReceiveFunds,
            openAccountOptions,
        }),
        [account, openSendFunds, openReceiveFunds, openAccountOptions],
    )

    return {
        openSendFunds,
        openReceiveFunds,
        openAccountOptions,
        isLoading,
        isRefreshing,
        handleRefresh,
        contextValue,
    }
}
