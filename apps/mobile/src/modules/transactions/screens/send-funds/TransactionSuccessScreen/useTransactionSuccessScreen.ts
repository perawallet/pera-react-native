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

import { useCallback, useEffect } from 'react'
import { BackHandler } from 'react-native'

import { useWebView } from '@modules/webview/hooks'
import { useSendFunds, useClaimAssets } from '@modules/transactions/hooks'
import { useNetwork } from '@perawallet/wallet-core-blockchain'
import { useRoute } from '@react-navigation/native'
import { generateUniqueId } from '@perawallet/wallet-core-shared'

type SuccessVariant =
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
    /**
     * Undefined on a network with no explorer (`custom`'s `explorerUrl` is `''`
     * by design), so the CTA is hidden rather than opening the schemeless
     * relative path the interpolation would otherwise produce. Same shape as
     * `useTransactionHashRow.onOpenExplorer`.
     */
    handleViewInExplorer: (() => void) | undefined
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
        const { onFinished: claimOnFinished } = useClaimAssets()
        const { networkConfig } = useNetwork()
        const { pushWebView } = useWebView()

        const isClaimFlow =
            routeVariant === 'claim' || routeVariant === 'reject'

        const variant: SuccessVariant = routeVariant
            ? routeVariant
            : isCloseAccount
              ? 'close_account'
              : 'payment'

        const handleDone = useCallback(() => {
            if (isClaimFlow) {
                claimOnFinished?.()
            } else {
                sendFundsOnFinished?.()
            }
        }, [isClaimFlow, claimOnFinished, sendFundsOnFinished])

        const viewInExplorer = useCallback(() => {
            if (!networkConfig.explorerUrl) return
            pushWebView({
                url: `${networkConfig.explorerUrl}/tx/${transactionId}`,
                id: generateUniqueId(),
            })
        }, [networkConfig.explorerUrl, transactionId, pushWebView])

        const handleViewInExplorer = networkConfig.explorerUrl
            ? viewInExplorer
            : undefined

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
