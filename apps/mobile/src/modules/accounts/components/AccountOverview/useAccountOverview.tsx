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
    addressOn,
    useAccountSummaryQuery,
    useEnsureAccountEnriched,
    useAccountScope,
    useSelectedAccount,
    type WalletAccount,
} from '@perawallet/wallet-core-accounts'
import {
    LEGACY_CHAIN_ID,
    type ChainId,
} from '@perawallet/wallet-core-chain-contract'
import { useBottomSheet } from '@modules/bottom-sheet'
import { useReceiveFunds } from '@modules/transactions'
import {
    ReceiveFundsContent,
    SendFundsContent,
    SEND_FUNDS_SHEET_ID,
} from '@modules/transactions/routes'
import { useSyncRefresh } from '@hooks/useSyncRefresh'
import {
    trackEvent,
    HomeEvent,
    AccountDetailsEvent,
    AnalyticsMetadataKey,
} from '@analytics'
import { AccountOptionsContent } from '../AccountOptionsContent'
import type { UseAccountOverviewModalResult } from './AccountOverviewModalContext'

export type UseAccountOverviewParams = {
    account: WalletAccount
}

export type UseAccountOverviewResult = {
    openSendFunds: () => void
    openReceiveFunds: () => void
    /** Opens receive straight on the chain's QR for `account`, which must already hold the chain. */
    openReceiveFundsOn: (account: WalletAccount, chainId: ChainId) => void
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
    const scope = useAccountScope(account, LEGACY_CHAIN_ID)
    const address = addressOn(account, scope)
    const { setSelectedAccount, setCanSelectAccount, setChainId } =
        useReceiveFunds()
    const { request: requestBottomSheet } = useBottomSheet()

    const openSendFunds = useCallback(() => {
        trackEvent(HomeEvent.Send, {
            [AnalyticsMetadataKey.ChainId]: scope.chainId,
        })
        void requestBottomSheet({
            id: SEND_FUNDS_SHEET_ID,
            contents: <SendFundsContent />,
            options: {
                size: 'modal',
                enablePanDownToClose: false,
                enableCloseOnBackdropPress: false,
                autoCreateContainer: false,
            },
        })
    }, [requestBottomSheet, scope.chainId])

    const requestReceiveSheet = useCallback(
        (sheetAccount: WalletAccount, chainId?: ChainId) => {
            void requestBottomSheet({
                contents: (
                    <ReceiveFundsContent
                        account={sheetAccount}
                        chainId={chainId}
                    />
                ),
                options: {
                    size: 'modal',
                    enablePanDownToClose: true,
                    autoCreateContainer: false,
                },
            })
        },
        [requestBottomSheet],
    )

    const openReceiveFunds = useCallback(() => {
        trackEvent(HomeEvent.Receive, {
            [AnalyticsMetadataKey.ChainId]: scope.chainId,
        })
        if (selectedAccount) {
            setCanSelectAccount(false)
            setSelectedAccount(selectedAccount)
        }
        requestReceiveSheet(account)
    }, [
        account,
        requestReceiveSheet,
        scope.chainId,
        selectedAccount,
        setCanSelectAccount,
        setSelectedAccount,
    ])

    const openReceiveFundsOn = useCallback(
        (current: WalletAccount, chainId: ChainId) => {
            trackEvent(HomeEvent.Receive, {
                [AnalyticsMetadataKey.ChainId]: chainId,
            })
            // The sheet picks its first screen on its first render, before its own effects can write the store.
            setCanSelectAccount(false)
            setSelectedAccount(current)
            setChainId(chainId)
            requestReceiveSheet(current, chainId)
        },
        [
            requestReceiveSheet,
            setCanSelectAccount,
            setSelectedAccount,
            setChainId,
        ],
    )

    const openAccountOptions = useCallback(() => {
        trackEvent(AccountDetailsEvent.More, {
            [AnalyticsMetadataKey.ChainId]: scope.chainId,
        })
        void requestBottomSheet({
            contents: (
                <AccountOptionsContent
                    account={account}
                    onShowAddress={openReceiveFundsOn}
                />
            ),
            options: {
                // Content-sized: the sheet swaps its whole body for a short
                // confirm panel when removing an account, and must shrink to it.
                size: 'auto',
                enablePanDownToClose: true,
                autoCreateContainer: false,
            },
        })
    }, [requestBottomSheet, account, openReceiveFundsOn, scope.chainId])

    // Reveal the header as soon as the (cheap, SQL-aggregate) balance summary
    // resolves. The value-change history is a separate, slower network query —
    // it must not hold the header in a skeleton (it would otherwise wait out
    // the wealth endpoint's timeout).
    const { isPending: isBalancesPending, isPaused: isBalancesPaused } =
        useAccountSummaryQuery(address, scope)
    // Guarantee the viewed account's holdings + metadata + prices are fetched
    // and enriched, regardless of the background poll's gating.
    useEnsureAccountEnriched(address, scope)
    const [hasCompletedInitialLoad, setHasCompletedInitialLoad] =
        useState(false)
    // A paused read counts as loaded: it will not resolve while offline, and
    // holding the skeleton would hide the SQLite-backed values underneath it.
    useEffect(() => {
        if (
            !hasCompletedInitialLoad &&
            (!isBalancesPending || isBalancesPaused)
        ) {
            setHasCompletedInitialLoad(true)
        }
    }, [hasCompletedInitialLoad, isBalancesPending, isBalancesPaused])
    const isLoading = !hasCompletedInitialLoad

    const refreshAddresses = useMemo(
        () => (address ? [address] : []),
        [address],
    )
    const { isRefreshing, refresh: handleRefresh } = useSyncRefresh({
        addresses: refreshAddresses,
        scope,
    })

    const contextValue = useMemo<UseAccountOverviewModalResult>(
        () => ({
            account,
            openSendFunds,
            openReceiveFunds,
            openReceiveFundsOn,
            openAccountOptions,
        }),
        [
            account,
            openSendFunds,
            openReceiveFunds,
            openReceiveFundsOn,
            openAccountOptions,
        ],
    )

    return {
        openSendFunds,
        openReceiveFunds,
        openReceiveFundsOn,
        openAccountOptions,
        isLoading,
        isRefreshing,
        handleRefresh,
        contextValue,
    }
}
