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

import { useCallback, useEffect, useMemo, useRef } from 'react'
import { type RouteProp, useRoute } from '@react-navigation/native'
import { Decimal } from 'decimal.js'
import {
    useSwapSigningAccounts,
    useSwapSourceScope,
    useSwapsStore,
} from '@perawallet/wallet-core-swaps'
import {
    useSelectedAccount,
    useSelectedAccountId,
} from '@perawallet/wallet-core-accounts'
import type { ChainScope } from '@perawallet/wallet-core-chain-contract'
import type { Nullable, Optional } from '@perawallet/wallet-core-shared'
import {
    useAccountListPicker,
    type AccountDrawerPickerProps,
} from '@modules/accounts'
import type { SwapScreenParams } from '@modules/swap/routes/types'
import { useSeedSwapRouteAssets } from './useSeedSwapRouteAssets'
import { useWebView } from '@modules/webview'
import { useSwapIntroduction } from '@modules/swap/hooks'
import { useBottomSheet } from '@modules/bottom-sheet'
import { SwapIntroductionContent } from '@modules/swap/components'
import { config } from '@perawallet/wallet-core-config'
import type { SwapFormInitialPayAmount } from '@modules/swap/components/SwapForm/useSwapForm'
import {
    resolveSwapRouteAssets,
    routeAssetInIdOn,
} from './resolveSwapRouteAssets'

export type UseSwapScreenResult = {
    /** Null when the selected account is on no chain that has swap. */
    scope: Nullable<ChainScope>
    initialPayAmount: Optional<SwapFormInitialPayAmount>
    accountPicker: AccountDrawerPickerProps
    handleInfoPress: () => void
}

export const useSwapScreen = (): UseSwapScreenResult => {
    const route =
        useRoute<RouteProp<{ Swap: Optional<SwapScreenParams> }, 'Swap'>>()
    const setFromAsset = useSwapsStore(state => state.setFromAsset)
    const setToAsset = useSwapsStore(state => state.setToAsset)
    const setSourceChainId = useSwapsStore(state => state.setSourceChainId)
    const selectedAccount = useSelectedAccount()
    const scope = useSwapSourceScope(selectedAccount)
    const signingAccounts = useSwapSigningAccounts()
    const accountPicker = useAccountListPicker(signingAccounts)
    const { setSelectedAccountId } = useSelectedAccountId()

    // Before the seeding effects: a chain change clears the pair they write.
    const routeSourceChainId = route.params?.assetIn?.chainId
    useEffect(() => {
        if (routeSourceChainId) setSourceChainId(routeSourceChainId)
    }, [routeSourceChainId, setSourceChainId])

    const resolvedAssets = scope
        ? resolveSwapRouteAssets(route.params, scope)
        : null
    // A chain with no known default output still opens on the route's input,
    // and the form pairs it with the chain's own receive asset.
    const assetInId =
        resolvedAssets?.assetInId ??
        (scope ? routeAssetInIdOn(route.params, scope) : undefined)
    const assetOutId = resolvedAssets?.assetOutId

    useSeedSwapRouteAssets({ assetInId, assetOutId, scope })

    useEffect(() => {
        if (
            selectedAccount &&
            !signingAccounts.some(a => a.id === selectedAccount.id) &&
            signingAccounts.length > 0
        ) {
            setSelectedAccountId(signingAccounts[0].id)
        }
    }, [selectedAccount, signingAccounts, setSelectedAccountId])

    useEffect(() => {
        if (!assetInId) return

        setFromAsset(assetInId)
        if (assetOutId) setToAsset(assetOutId)
    }, [assetInId, assetOutId, setFromAsset, setToAsset])

    const payAmount = route.params?.payAmount
    const initialPayAmount = useMemo(
        () =>
            payAmount && assetInId
                ? { assetId: assetInId, amount: new Decimal(payAmount) }
                : undefined,
        [payAmount, assetInId],
    )

    const { pushWebView } = useWebView()
    const { isIntroductionSeen, markIntroductionSeen } = useSwapIntroduction()
    const { request: requestBottomSheet } = useBottomSheet()

    const hasShownIntroRef = useRef(false)
    useEffect(() => {
        if (isIntroductionSeen || hasShownIntroRef.current) return
        hasShownIntroRef.current = true
        void requestBottomSheet<'start'>({
            contents: <SwapIntroductionContent />,
            options: {
                size: 'auto',
                enablePanDownToClose: true,
                autoCreateContainer: false,
            },
        }).then(result => {
            if (result === 'start') {
                markIntroductionSeen()
            }
        })
    }, [isIntroductionSeen, requestBottomSheet, markIntroductionSeen])

    const handleInfoPress = useCallback(() => {
        pushWebView({ url: config.swapSupportUrl })
    }, [pushWebView])

    return { scope, initialPayAmount, accountPicker, handleInfoPress }
}
