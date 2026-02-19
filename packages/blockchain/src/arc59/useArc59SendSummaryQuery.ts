/*
 Copyright 2022-2025 Pera Wallet, LDA
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
import { useNetwork } from '@perawallet/wallet-core-platform-integration'
import { fetchArc59SendSummary } from './api'
import type { Arc59SendSummaryResponse } from './schema'

const MODULE_PREFIX = 'arc59'

export const getArc59SendSummaryQueryKey = (
    receiverAddress: string,
    assetId: string,
) => [MODULE_PREFIX, 'send-summary', { receiverAddress, assetId }]

type UseArc59SendSummaryQueryResult = {
    summary: Arc59SendSummaryResponse | null
    isLoading: boolean
    isError: boolean
    error: Error | null
}

export const useArc59SendSummaryQuery = (
    receiverAddress: string,
    assetId: string,
): UseArc59SendSummaryQueryResult => {
    const { networkConfig } = useNetwork()

    const query = useQuery({
        queryKey: getArc59SendSummaryQueryKey(receiverAddress, assetId),
        queryFn: () =>
            fetchArc59SendSummary(
                networkConfig.backendUrl,
                receiverAddress,
                assetId,
            ),
        enabled: !!receiverAddress && !!assetId,
    })

    return {
        summary: query.data ?? null,
        isLoading: query.isLoading,
        isError: query.isError,
        error: query.error,
    }
}
