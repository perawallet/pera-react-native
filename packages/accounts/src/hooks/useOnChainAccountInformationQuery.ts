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

import { useQuery, type RefetchOptions } from '@tanstack/react-query'
import {
    LEGACY_CHAIN_ID,
    legacyNetworkOf,
    type AccountInformation,
} from '@perawallet/wallet-core-chain-contract'
import { useSelectedScope } from '@perawallet/wallet-core-chain-shared'
import { fetchAccountInformation } from '../chain-adapter'
import { getOnChainAccountInformationQueryKey } from './querykeys'

import type { Optional } from '@perawallet/wallet-core-shared'

// Short freshness window instead of refetch-on-every-mount: send-flow
// navigation remounts consumers several times back-to-back, and each remount
// was a guaranteed algod hit.
const ON_CHAIN_ACCOUNT_INFO_STALE_TIME_MS = 15_000

export type UseOnChainAccountInformationQueryResult = {
    /** `undefined` until loaded; callers gate on it, so no default. */
    data: Optional<AccountInformation>
    isPending: boolean
    isLoading: boolean
    isFetching: boolean
    isSuccess: boolean
    isError: boolean
    refetch: (options?: RefetchOptions) => unknown
}

export const useOnChainAccountInformationQuery = (
    address: string,
): UseOnChainAccountInformationQueryResult => {
    const scope = useSelectedScope(LEGACY_CHAIN_ID)
    const network = legacyNetworkOf(scope)

    const query = useQuery({
        queryKey: getOnChainAccountInformationQueryKey(address, scope),
        queryFn: () => fetchAccountInformation(address, network),
        enabled: !!address,
        staleTime: ON_CHAIN_ACCOUNT_INFO_STALE_TIME_MS,
    })

    return {
        data: query.data,
        isPending: query.isPending,
        isLoading: query.isLoading,
        isFetching: query.isFetching,
        isSuccess: query.isSuccess,
        isError: query.isError,
        refetch: query.refetch,
    }
}
