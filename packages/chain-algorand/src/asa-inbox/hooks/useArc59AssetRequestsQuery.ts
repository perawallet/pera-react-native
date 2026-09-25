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
import { useNetwork } from '@perawallet/wallet-core-blockchain'
import { isPeraBackedNetwork } from '@perawallet/wallet-core-config'
import { fetchArc59AssetRequests, type Arc59AssetRequest } from '../api'
import { getArc59AssetRequestsQueryKey } from './querykeys'
import type { Nullable } from '@perawallet/wallet-core-shared'

export type UseArc59AssetRequestsQueryResult = {
    data: Arc59AssetRequest[]
    isPending: boolean
    isError: boolean
    error: Nullable<Error>
    /** True when the active network has no Pera backend — this can never succeed here. */
    isUnavailableOnNetwork: boolean
}

export const useArc59AssetRequestsQuery = (
    address: Nullable<string>,
): UseArc59AssetRequestsQueryResult => {
    const { network } = useNetwork()
    const isUnavailableOnNetwork = !isPeraBackedNetwork(network)

    const query = useQuery({
        queryKey: getArc59AssetRequestsQueryKey(address ?? '', network),
        queryFn: () => fetchArc59AssetRequests(network, address!),
        enabled: !!address && !isUnavailableOnNetwork,
    })

    return {
        data: query.data ?? [],
        isPending: isUnavailableOnNetwork ? false : query.isPending,
        isError: query.isError,
        error: query.error,
        isUnavailableOnNetwork,
    }
}
