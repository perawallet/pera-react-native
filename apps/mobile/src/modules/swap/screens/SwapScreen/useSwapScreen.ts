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

import { useEffect, useMemo } from 'react'
import { type RouteProp, useRoute } from '@react-navigation/native'
import { useSwaps } from '@perawallet/wallet-core-swaps'
import {
    useSelectedAccount,
    useSelectedAccountId,
    useSigningAccounts,
} from '@perawallet/wallet-core-accounts'
import { LEGACY_CHAIN_ID } from '@perawallet/wallet-core-chain-contract'
import { useSelectedScope } from '@perawallet/wallet-core-chain-shared'
import type { Optional } from '@perawallet/wallet-core-shared'
import type { SwapScreenParams } from '@modules/swap/routes/types'
import { useSeedSwapRouteAssets } from './useSeedSwapRouteAssets'
import type { SwapFormInitialPayAmount } from '@modules/swap/components/SwapForm/useSwapForm'
import { resolveSwapRouteAssets } from './resolveSwapRouteAssets'

export type UseSwapScreenResult = {
    initialPayAmount: SwapFormInitialPayAmount | undefined
}

export const useSwapScreen = (): UseSwapScreenResult => {
    const scope = useSelectedScope(LEGACY_CHAIN_ID)
    const route =
        useRoute<RouteProp<{ Swap: Optional<SwapScreenParams> }, 'Swap'>>()
    const { setFromAsset, setToAsset } = useSwaps(scope)
    const selectedAccount = useSelectedAccount()
    const signingAccounts = useSigningAccounts(scope.chainId)
    const { setSelectedAccountId } = useSelectedAccountId()

    const resolvedAssets = resolveSwapRouteAssets(route.params, scope)
    const assetInId = resolvedAssets?.assetInId
    const assetOutId = resolvedAssets?.assetOutId

    useSeedSwapRouteAssets({ assetInId, assetOutId })

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
        if (!assetInId || !assetOutId) return

        setFromAsset(assetInId)
        setToAsset(assetOutId)
    }, [assetInId, assetOutId, setFromAsset, setToAsset])

    const payAmount = route.params?.payAmount
    const initialPayAmount = useMemo(
        () =>
            payAmount && assetInId
                ? { assetId: assetInId, amount: payAmount }
                : undefined,
        [payAmount, assetInId],
    )

    return { initialPayAmount }
}
