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
import {
    type NavigationProp,
    type RouteProp,
    useIsFocused,
    useNavigation,
    useRoute,
} from '@react-navigation/native'
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
    const navigation =
        useNavigation<NavigationProp<{ Swap: Optional<SwapScreenParams> }>>()
    const setFromAsset = useSwapsStore(state => state.setFromAsset)
    const setToAsset = useSwapsStore(state => state.setToAsset)
    const setReceivingAccountId = useSwapsStore(
        state => state.setReceivingAccountId,
    )
    const sourceChainId = useSwapsStore(state => state.sourceChainId)
    const setSourceChainId = useSwapsStore(state => state.setSourceChainId)
    const selectedAccount = useSelectedAccount()
    const scope = useSwapSourceScope(selectedAccount)
    const signingAccounts = useSwapSigningAccounts()
    const accountPicker = useAccountListPicker(signingAccounts)
    const { setSelectedAccountId } = useSelectedAccountId()

    // A chain change the store didn't make, such as an account switch, keeps the
    // old chain's pair: the form remounts while focused, past both of its resets.
    const swapChainId = scope?.chainId
    const previousChainsRef = useRef({ swapChainId, sourceChainId })
    useEffect(() => {
        const previous = previousChainsRef.current
        previousChainsRef.current = { swapChainId, sourceChainId }
        if (
            previous.swapChainId &&
            swapChainId &&
            previous.swapChainId !== swapChainId &&
            previous.sourceChainId === sourceChainId
        ) {
            setSourceChainId(sourceChainId)
        }
    }, [swapChainId, sourceChainId, setSourceChainId])

    // Before the seeding effects: a chain change clears the pair they write.
    const routeSourceChainId = route.params?.assetIn?.chainId
    useEffect(() => {
        if (routeSourceChainId) setSourceChainId(routeSourceChainId)
    }, [routeSourceChainId, setSourceChainId])

    // A pick that moves the swap off the route's chain spends the route: left in
    // place, it would seed its pair over the user's next pick on that chain.
    const previousSourceChainRef = useRef(sourceChainId)
    useEffect(() => {
        const previous = previousSourceChainRef.current
        previousSourceChainRef.current = sourceChainId
        if (
            routeSourceChainId &&
            previous === routeSourceChainId &&
            sourceChainId !== routeSourceChainId
        ) {
            navigation.setParams({
                assetIn: undefined,
                assetOut: undefined,
                receive: undefined,
                payAmount: undefined,
            })
        }
    }, [navigation, routeSourceChainId, sourceChainId])

    // Until the store holds the route's chain, scope is still the previous one,
    // and a pair seeded from it would outlive the chain change.
    const routeScope =
        !routeSourceChainId || sourceChainId === routeSourceChainId
            ? scope
            : null
    const resolvedAssets = routeScope
        ? resolveSwapRouteAssets(route.params, routeScope)
        : null
    // A chain with no known default output still opens on the route's input,
    // and the form pairs it with the chain's own receive asset.
    const assetInId =
        resolvedAssets?.assetInId ??
        (routeScope ? routeAssetInIdOn(route.params, routeScope) : undefined)
    const assetOutId = resolvedAssets?.assetOutId
    const routeReceive = route.params?.receive

    useSeedSwapRouteAssets({
        assetInId,
        assetOutId: routeReceive?.assetId ?? assetOutId,
        assetOutScope: routeReceive?.scope,
        scope: routeScope,
    })

    // The tab stays mounted once opened, and the selection is app-wide: switching
    // while another screen is in front would undo an account picked there.
    const isFocused = useIsFocused()
    useEffect(() => {
        if (
            isFocused &&
            selectedAccount &&
            !signingAccounts.some(a => a.id === selectedAccount.id) &&
            signingAccounts.length > 0
        ) {
            setSelectedAccountId(signingAccounts[0].id)
        }
    }, [isFocused, selectedAccount, signingAccounts, setSelectedAccountId])

    useEffect(() => {
        if (!assetInId) return

        setFromAsset(assetInId)
        if (routeReceive) {
            setToAsset(routeReceive.assetId, routeReceive.scope)
            setReceivingAccountId(routeReceive.accountId)
            return
        }
        if (assetOutId) setToAsset(assetOutId)
    }, [
        assetInId,
        assetOutId,
        routeReceive,
        setFromAsset,
        setToAsset,
        setReceivingAccountId,
    ])

    const payAmount = route.params?.payAmount
    // The form reads this once on mount, which can be before the chain is pinned.
    const payAssetId = assetInId ?? route.params?.assetIn?.assetId
    const payChainId = routeSourceChainId ?? scope?.chainId
    const initialPayAmount = useMemo(
        () =>
            payAmount && payAssetId && payChainId
                ? {
                      chainId: payChainId,
                      assetId: payAssetId,
                      amount: new Decimal(payAmount),
                  }
                : undefined,
        [payAmount, payAssetId, payChainId],
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
