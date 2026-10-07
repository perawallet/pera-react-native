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

import { useQuery } from '@tanstack/react-query'
import {
    LEGACY_CHAIN_ID,
    legacyNetworkOf,
} from '@perawallet/wallet-core-chain-contract'
import { useSelectedScope } from '@perawallet/wallet-core-chain-shared'
import { fetchAvailableAssets } from '../api'
import { swapQueryKeys } from './querykeys'

export const useAvailableAssetsQuery = (
    assetInId: number,
    q?: string,
    enabled: boolean = true,
) => {
    const scope = useSelectedScope(LEGACY_CHAIN_ID)
    const network = legacyNetworkOf(scope)

    return useQuery({
        queryKey: swapQueryKeys.availableAssets(assetInId, q, scope),
        queryFn: () => fetchAvailableAssets(assetInId, network, q),
        enabled,
    })
}
