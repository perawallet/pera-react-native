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

import { useCallback, useEffect } from 'react'
import { BackHandler } from 'react-native'

import { useWebView } from '@modules/webview/hooks'
import { useSendFunds, useClaimAssets } from '@modules/transactions/hooks'
import {
    useRemoveAccountById,
    useSelectedAccount,
    useSelectedAccountAddress,
    useAccountsStore,
} from '@perawallet/wallet-core-accounts'
import { useNetwork } from '@perawallet/wallet-core-platform-integration'
import { useRoute } from '@react-navigation/native'
import { generateUniqueId } from '@perawallet/wallet-core-shared'
import { useQueryClient } from '@tanstack/react-query'
import { getArc59AssetRequestsQueryKey } from '@perawallet/wallet-core-asa-inbox'

export type SuccessVariant =
    | 'payment'
    | 'asset_transfer'
    | 'close_account'
    | 'claim'
    | 'reject'

type SuccessRouteParams = {
    transactionId: string
    variant?: SuccessVariant
}

type UseTransactionSuccessScreenResult = {
    handleDone: () => void
    handleViewInExplorer: () => void
    variant: SuccessVariant
}

export const useTransactionSuccessScreen =
    (): UseTransactionSuccessScreenResult => {
        const route = useRoute<{
            key: string
            name: string
            params: SuccessRouteParams
        }>()
        const { transactionId, variant: routeVariant } = route.params
        const { onFinished: sendFundsOnFinished, isCloseAccount } =
            useSendFunds()
        const {
            onFinished: claimOnFinished,
            accountAddress: claimAccountAddress,
        } = useClaimAssets()
        const { networkConfig } = useNetwork()
        const { pushWebView } = useWebView()
        const removeAccountById = useRemoveAccountById()
        const selectedAccount = useSelectedAccount()
        const accounts = useAccountsStore(state => state.accounts)
        const { setSelectedAccountAddress } = useSelectedAccountAddress()
        const queryClient = useQueryClient()

        const isClaimFlow =
            routeVariant === 'claim' || routeVariant === 'reject'

        const variant: SuccessVariant = routeVariant
            ? routeVariant
            : isCloseAccount
              ? 'close_account'
              : 'payment'

        const handleDone = useCallback(() => {
            if (isClaimFlow) {
                if (claimAccountAddress) {
                    queryClient.invalidateQueries({
                        queryKey:
                            getArc59AssetRequestsQueryKey(claimAccountAddress),
                    })
                }
                claimOnFinished?.()
            } else {
                if (isCloseAccount && selectedAccount?.id) {
                    removeAccountById(selectedAccount.id)
                    const remaining = accounts.filter(
                        a => a.id !== selectedAccount.id,
                    )
                    setSelectedAccountAddress(
                        remaining.length > 0 ? remaining[0].address : null,
                    )
                }
                sendFundsOnFinished?.()
            }
        }, [
            isClaimFlow,
            claimOnFinished,
            claimAccountAddress,
            queryClient,
            sendFundsOnFinished,
            isCloseAccount,
            selectedAccount,
            removeAccountById,
            accounts,
            setSelectedAccountAddress,
        ])

        const handleViewInExplorer = useCallback(() => {
            pushWebView({
                url: `${networkConfig.explorerUrl}/tx/${transactionId}`,
                id: generateUniqueId(),
            })
        }, [networkConfig.explorerUrl, transactionId, pushWebView])

        useEffect(() => {
            const subscription = BackHandler.addEventListener(
                'hardwareBackPress',
                () => {
                    handleDone()
                    return true
                },
            )
            return () => subscription.remove()
        }, [handleDone])

        return {
            handleDone,
            handleViewInExplorer,
            variant,
        }
    }
