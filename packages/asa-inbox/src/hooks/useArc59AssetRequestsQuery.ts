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

import { useQuery, type UseQueryResult } from '@tanstack/react-query'
import { useNetwork } from '@perawallet/wallet-core-blockchain'
import { fetchArc59AssetRequests, type Arc59AssetRequest } from '../api'
import { getArc59AssetRequestsQueryKey } from './querykeys'
import type { Nullable } from '@perawallet/wallet-core-shared'

export const useArc59AssetRequestsQuery = (
    address: Nullable<string>,
): UseQueryResult<Arc59AssetRequest[], Error> => {
    const { network } = useNetwork()

    return useQuery({
        queryKey: getArc59AssetRequestsQueryKey(address ?? ''),
        queryFn: () => fetchArc59AssetRequests(network, address!),
        enabled: !!address,
    })
}
