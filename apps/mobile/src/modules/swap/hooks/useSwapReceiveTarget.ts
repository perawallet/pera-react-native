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
    addressOn,
    chainAccountOf,
    useAllAccounts,
} from '@perawallet/wallet-core-accounts'
import {
    toScopeKey,
    type ChainScope,
} from '@perawallet/wallet-core-chain-contract'
import type { Nullable } from '@perawallet/wallet-core-shared'
import {
    swapPayoutAddressOn,
    useSwapsStore,
    useSwapAccount,
} from '@perawallet/wallet-core-swaps'

export type UseSwapReceiveTargetResult = {
    receiveScope: ChainScope
    isCrossChain: boolean
    receivingAddress: Nullable<string>
    /** The swap account has no entry on `receiveScope` yet; the swap enables it. */
    shouldEnableReceiveChain: boolean
}

/**
 * Where the swap's output lands: always the swap account, at its address on
 * the destination network.
 */
export const useSwapReceiveTarget = (
    scope: ChainScope,
): UseSwapReceiveTargetResult => {
    const toAssetScope = useSwapsStore(state => state.toAssetScope)
    const swapAccount = useSwapAccount()
    const accounts = useAllAccounts()

    const receiveScope = toAssetScope ?? scope
    const isCrossChain = toScopeKey(receiveScope) !== toScopeKey(scope)

    return useMemo(() => {
        if (!swapAccount) {
            return {
                receiveScope,
                isCrossChain,
                receivingAddress: null,
                shouldEnableReceiveChain: false,
            }
        }
        const receivingAddress =
            (isCrossChain
                ? swapPayoutAddressOn(
                      swapAccount,
                      accounts,
                      receiveScope.chainId,
                  )
                : addressOn(swapAccount, receiveScope)) ?? null
        return {
            receiveScope,
            isCrossChain,
            receivingAddress,
            shouldEnableReceiveChain:
                isCrossChain &&
                receivingAddress !== null &&
                chainAccountOf(swapAccount, receiveScope.chainId) === undefined,
        }
    }, [swapAccount, accounts, receiveScope, isCrossChain])
}
