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
import type { Maybe, Nullable } from '@perawallet/wallet-core-shared'
import { fetchArc59SendSummary } from '../api'
import type { Arc59SendSummaryResponse } from '../api'
import { getArc59SendSummaryQueryKey } from './querykeys'

export type UseArc59SendSummaryQueryResult = {
    data: Maybe<Arc59SendSummaryResponse>
    isLoading: boolean
    isError: boolean
    error: Nullable<Error>
    /** True when the active network has no Pera backend — this can never succeed here. */
    isUnavailableOnNetwork: boolean
}

export const useArc59SendSummaryQuery = (
    receiverAddress: string,
    assetId: string,
): UseArc59SendSummaryQueryResult => {
    const { network } = useNetwork()
    const isUnavailableOnNetwork = !isPeraBackedNetwork(network)

    const query = useQuery({
        queryKey: getArc59SendSummaryQueryKey(
            receiverAddress,
            assetId,
            network,
        ),
        queryFn: () => fetchArc59SendSummary(network, receiverAddress, assetId),
        enabled: !!receiverAddress && !!assetId && !isUnavailableOnNetwork,
    })

    return {
        data: query.data,
        isLoading: isUnavailableOnNetwork ? false : query.isLoading,
        isError: query.isError,
        error: query.error,
        isUnavailableOnNetwork,
    }
}
