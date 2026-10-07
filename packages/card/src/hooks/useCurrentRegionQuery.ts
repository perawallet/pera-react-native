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
import { config } from '@perawallet/wallet-core-config'
import { fetchCurrentRegion } from '../api/region'
import { cardQueryKeys } from './querykeys'

export const useCurrentRegionQuery = () => {
    const scope = useSelectedScope(LEGACY_CHAIN_ID)
    const network = legacyNetworkOf(scope)

    return useQuery({
        queryKey: cardQueryKeys.currentRegion(scope),
        queryFn: ({ signal }) => fetchCurrentRegion({ network, signal }),
        staleTime: config.reactQueryLongLivedStaleTime,
    })
}
