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

import { useWebView } from '@modules/webview'
import {
    useSendFunds,
    useClaimAssets,
    useSendScope,
} from '@modules/transactions/hooks'
import { getChainDescriptor } from '@perawallet/wallet-core-chain-shared'
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
    /** Undefined on a network with no explorer, such as a custom one, so the CTA is hidden. */
    handleViewInExplorer: (() => void) | undefined
    variant: SuccessVariant
    /** The send is only broadcast; History shows it confirm or fail. */
    isAwaitingConfirmation: boolean
    networkName: string
    explorerName: string
}

const successVariantOf = (
    routeVariant: SuccessRouteParams['variant'],
    isCloseAccount: boolean,
): SuccessVariant => {
    if (routeVariant) return routeVariant
    return isCloseAccount ? 'close_account' : 'payment'
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
        const scope = useSendScope()
        const descriptor = getChainDescriptor(scope.chainId)
        const explorerUrl = descriptor.explorer.transactionUrl(
            scope.networkId,
            transactionId,
        )
        const { pushWebView } = useWebView()

        const isClaimFlow =
            routeVariant === 'claim' || routeVariant === 'reject'

        const variant = successVariantOf(routeVariant, isCloseAccount)

        const handleDone = useCallback(() => {
            if (isClaimFlow) {
                claimOnFinished?.()
            } else {
                sendFundsOnFinished?.()
            }
        }, [isClaimFlow, claimOnFinished, sendFundsOnFinished])

        const viewInExplorer = useCallback(() => {
            if (!explorerUrl) return
            // oxlint-disable-next-line pera/no-unvalidated-open-url -- chain descriptor explorer URL
            pushWebView({ url: explorerUrl, id: generateUniqueId() })
        }, [explorerUrl, pushWebView])

        const handleViewInExplorer = explorerUrl ? viewInExplorer : undefined

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
            isAwaitingConfirmation: !descriptor.protocol.confirmsOnSubmit,
            networkName: descriptor.displayName,
            explorerName: descriptor.explorer.name,
        }
    }
