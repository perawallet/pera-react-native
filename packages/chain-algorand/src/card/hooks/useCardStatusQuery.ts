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

import { useQuery, type UseQueryOptions } from '@tanstack/react-query'
import { useNetwork } from '@perawallet/wallet-core-blockchain'
import { config } from '@perawallet/wallet-core-config'
import type { Nullable } from '@perawallet/wallet-core-shared'
import { fetchCardStatus } from '../api/card'
import type { Card } from '../models'
import { cardQueryKeys } from './querykeys'

type CardStatusRefetchInterval = UseQueryOptions<
    Nullable<Card>,
    Error,
    Nullable<Card>,
    ReturnType<typeof cardQueryKeys.status>
>['refetchInterval']

export type UseCardStatusQueryOptions = {
    enabled?: boolean
    /**
     * Poll interval in ms, `false`, or a function of the live query (lets
     * pollers stop from the freshest data): used to watch a just-ordered
     * card until it turns ACTIVE.
     */
    refetchInterval?: CardStatusRefetchInterval
}

/** `data` is `null` when no card has been ordered. */
export const useCardStatusQuery = (options?: UseCardStatusQueryOptions) => {
    const { network } = useNetwork()

    return useQuery({
        queryKey: cardQueryKeys.status(network),
        queryFn: ({ signal }) => fetchCardStatus({ network, signal }),
        staleTime: config.reactQueryShortLivedStaleTime,
        enabled: options?.enabled ?? true,
        refetchInterval: options?.refetchInterval,
    })
}
