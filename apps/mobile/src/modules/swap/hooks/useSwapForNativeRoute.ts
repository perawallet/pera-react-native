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

import { useMemo } from 'react'
import {
    useAccountChainStateStore,
    useAccountHoldingsAcrossChainsQuery,
    useAllAccounts,
    useCanSignWithCheck,
    type WalletAccount,
} from '@perawallet/wallet-core-accounts'
import { nativeAssetFor } from '@perawallet/wallet-core-assets'
import type { ChainId } from '@perawallet/wallet-core-chain-contract'
import { useChainCapabilityCheck } from '@perawallet/wallet-core-chain-shared'
import type { Nullable } from '@perawallet/wallet-core-shared'
import { useSwapScope } from '@perawallet/wallet-core-swaps'
import type { SwapScreenParams } from '../routes/types'
import {
    canReceiveCrossChain,
    canSwapCrossChain,
} from '../utils/crossChainEligibility'
import { pickSwapPayAsset } from '../utils/pickSwapPayAsset'

export type UseSwapForNativeRouteResult = {
    /** Opens a cross-chain swap into `chainId`'s native coin; null when none can. */
    params: Nullable<SwapScreenParams>
    /** Holdings on other chains are still being read, so `params` isn't settled. */
    isPending: boolean
}

/**
 * A swap that gets `account` `chainId`'s native coin, paid from what it holds
 * on another chain. Receiving follows the Swap form's own rules, so a route
 * offered here is one the form can complete.
 */
export const useSwapForNativeRoute = (
    account: WalletAccount,
    chainId: ChainId,
): UseSwapForNativeRouteResult => {
    const accounts = useAllAccounts()
    const chainStates = useAccountChainStateStore(state => state.states)
    const receiveScope = useSwapScope(account, chainId)
    const canSignOn = useCanSignWithCheck()
    const hasCapability = useChainCapabilityCheck()
    const { assetBalances, isPending } =
        useAccountHoldingsAcrossChainsQuery(account)

    const params = useMemo((): Nullable<SwapScreenParams> => {
        if (
            !receiveScope ||
            !canSwapCrossChain(account) ||
            !canReceiveCrossChain(account, accounts, chainId)
        ) {
            return null
        }
        const payAsset = pickSwapPayAsset(
            assetBalances,
            receiveScope,
            payChainId =>
                hasCapability({
                    chain: { chainId: payChainId, capability: 'swap' },
                }) && canSignOn(account, payChainId),
        )
        if (!payAsset) return null
        return {
            assetIn: {
                chainId: payAsset.scope.chainId,
                assetId: payAsset.assetId,
            },
            receive: {
                scope: receiveScope,
                assetId: nativeAssetFor(chainId).assetId,
                accountId: account.id,
            },
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps -- chainStates re-runs the memo: canReceiveCrossChain reads the chain-state store, not its arguments
    }, [
        receiveScope,
        account,
        accounts,
        chainId,
        assetBalances,
        hasCapability,
        canSignOn,
        chainStates,
    ])

    return { params, isPending }
}
