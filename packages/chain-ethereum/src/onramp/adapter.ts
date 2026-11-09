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

import { useCallback } from 'react'
import { useAddIncomingTokenMutation } from '@perawallet/wallet-core-accounts'
import type {
    EnsureCanReceive,
    RampChainAdapter,
} from '@perawallet/wallet-core-onramp'
import { evmAssetIdOfRouterId } from '../blockchain/utils/caip19'
import type { EvmChain } from '../chains/types'

// Nothing to sign: the purchase arrives in someone else's transfer, so the
// bought token is added for every later read to include. Not awaited, since
// the delivery is minutes away and the order mustn't wait on a metadata read.
const useEnsureCanReceive = (): EnsureCanReceive => {
    const { addIncomingToken } = useAddIncomingTokenMutation()
    return useCallback(
        async ({ address, scope, assetId }) => {
            void addIncomingToken({ accountAddress: address, scope, assetId })
            return true
        },
        [addIncomingToken],
    )
}

export const createEvmRampAdapter = (chain: EvmChain): RampChainAdapter => ({
    chainId: chain.row.id,
    fromRouterAssetId: (routerAssetId, scope) =>
        evmAssetIdOfRouterId(routerAssetId, scope, chain),
    useEnsureCanReceive,
    // Only tokens the router lists as destinations can be bought.
    isBuyLimitedToDestinations: true,
})
