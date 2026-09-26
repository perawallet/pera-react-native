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
import type { Nullable } from '@perawallet/wallet-core-shared'
import { fetchUser } from '../api/user'
import type { CardUser } from '../models'
import { cardQueryKeys } from './querykeys'

type CardUserRefetchInterval = UseQueryOptions<
    Nullable<CardUser>,
    Error,
    Nullable<CardUser>,
    ReturnType<typeof cardQueryKeys.user>
>['refetchInterval']

export type UseCardUserQueryOptions = {
    enabled?: boolean
    /**
     * Poll interval in ms, `false`, or a function of the live query (lets
     * pollers stop from the freshest data): used to watch the KYC state.
     */
    refetchInterval?: CardUserRefetchInterval
}

/** `data` is the `CardUser` (or `null`); read `data?.verificationState` to gate KYC. */
export const useCardUserQuery = (options?: UseCardUserQueryOptions) => {
    const { network } = useNetwork()

    return useQuery({
        queryKey: cardQueryKeys.user(network),
        queryFn: ({ signal }) => fetchUser({ network, signal }),
        enabled: options?.enabled ?? true,
        refetchInterval: options?.refetchInterval,
    })
}
