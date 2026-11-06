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

import type { WalletAccount } from '@perawallet/wallet-core-accounts'
import type { ChainId } from '@perawallet/wallet-core-chain-contract'
import type { Nullable } from '@perawallet/wallet-core-shared'

import { rampChainAdapters } from '../chain-adapter'
import { rampTokenAsset } from '../token-identity'
import { useOnrampScope } from './useOnrampScope'
import { useRampDestinationsQuery } from './useRampDestinationsQuery'

export type UseCanBuyAssetParams = {
    account: Nullable<WalletAccount>
    chainId: ChainId
    assetId?: string
}

/**
 * Whether Fund offers to buy `assetId` on `chainId` for `account`. With no
 * `assetId` it answers for the chain alone.
 */
export const useCanBuyAsset = ({
    account,
    chainId,
    assetId,
}: UseCanBuyAssetParams): boolean => {
    const scope = useOnrampScope(account, chainId)
    const isLimited =
        scope !== null &&
        assetId !== undefined &&
        rampChainAdapters.get(scope.chainId).isBuyLimitedToDestinations === true
    const destinations = useRampDestinationsQuery({
        scope,
        enabled: isLimited,
    })

    if (scope === null) return false
    if (!isLimited) return true
    return destinations.data.some(
        token => rampTokenAsset(token, scope)?.assetId === assetId,
    )
}
