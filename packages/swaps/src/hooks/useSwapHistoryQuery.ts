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
import { useNetwork } from '@perawallet/wallet-core-blockchain'
import { fetchSwapHistory } from '../api'
import { swapQueryKeys } from './querykeys'
import type { SwapHistoryItem } from '../models'

type UseSwapHistoryQueryResult = {
    data: SwapHistoryItem[]
    next: string | null | undefined
    previous: string | null | undefined
    isPending: boolean
    isFetched: boolean
    isError: boolean
    error: Error | null
    refetch: () => void
}

export const useSwapHistoryQuery = (
    address: string,
    statuses?: string,
    enabled: boolean = true,
): UseSwapHistoryQueryResult => {
    const { network } = useNetwork()

    const query = useQuery({
        queryKey: swapQueryKeys.history(address, statuses, network),
        queryFn: () => fetchSwapHistory(address, network, statuses),
        enabled,
    })

    return {
        data: query.data?.results ?? [],
        next: query.data?.next,
        previous: query.data?.previous,
        isPending: query.isPending,
        isFetched: query.isFetched,
        isError: query.isError,
        error: query.error,
        refetch: query.refetch,
    }
}
