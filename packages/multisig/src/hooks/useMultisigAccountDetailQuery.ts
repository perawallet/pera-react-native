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

import { useCallback } from 'react'
import {
    useQuery,
    type FetchStatus,
    type RefetchOptions,
} from '@tanstack/react-query'
import type { Nullable, Network } from '@perawallet/wallet-core-shared'
import type { MultiSigAccount } from '../models'
import { getMultisigAccountDetail } from '../api/endpoints'
import { mapMultiSigAccount } from '../mappers'
import { getMultisigAccountDetailQueryKey } from './querykeys'

type UseMultisigAccountDetailQueryParams = {
    network: Network
    address: string
    enabled?: boolean
}

export type UseMultisigAccountDetailQueryResult = {
    data: MultiSigAccount | undefined
    isLoading: boolean
    isFetching: boolean
    isSuccess: boolean
    isError: boolean
    error: Nullable<Error>
    fetchStatus: FetchStatus
    refetch: (options?: RefetchOptions) => unknown
}

export const useMultisigAccountDetailQuery = ({
    network,
    address,
    enabled = true,
}: UseMultisigAccountDetailQueryParams): UseMultisigAccountDetailQueryResult => {
    const query = useQuery({
        queryKey: getMultisigAccountDetailQueryKey(network, address),
        queryFn: () => getMultisigAccountDetail(network, address),
        enabled: enabled && !!address,
        select: useCallback(mapMultiSigAccount, []),
    })

    return {
        data: query.data,
        isLoading: query.isLoading,
        isFetching: query.isFetching,
        isSuccess: query.isSuccess,
        isError: query.isError,
        error: query.error,
        fetchStatus: query.fetchStatus,
        refetch: query.refetch,
    }
}
