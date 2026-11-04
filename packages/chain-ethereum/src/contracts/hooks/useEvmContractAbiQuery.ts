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
import type { Address } from 'viem'
import {
    isEvmChainId,
    type ChainScope,
} from '@perawallet/wallet-core-chain-contract'
import type { Optional } from '@perawallet/wallet-core-shared'
import { evmChainOf } from '../../chains/table'
import { fetchEvmContractAbi } from '../api/endpoints'
import type { EvmContractAbiAnswer } from '../types'
import { contractAbiQueryKey } from './querykeys'

// The backend refreshes a proxy's implementation on its own schedule; this
// only spares a review the same lookup twice in a row.
const STALE_TIME_MS = 10 * 60_000

export type UseEvmContractAbiQueryParams = {
    scope: ChainScope
    address: Optional<Address>
    isEnabled: boolean
}

export type UseEvmContractAbiQueryResult = {
    data: Optional<EvmContractAbiAnswer>
    isPending: boolean
    isError: boolean
}

export const useEvmContractAbiQuery = ({
    scope,
    address,
    isEnabled,
}: UseEvmContractAbiQueryParams): UseEvmContractAbiQueryResult => {
    const isQueryEnabled = isEnabled && !!address && isEvmChainId(scope.chainId)
    const query = useQuery({
        queryKey: contractAbiQueryKey(scope, address ?? ''),
        queryFn: () => {
            if (!address || !isEvmChainId(scope.chainId)) {
                throw new Error('A verified ABI lookup needs an EVM contract')
            }
            return fetchEvmContractAbi(
                scope,
                evmChainOf(scope.chainId),
                address,
            )
        },
        enabled: isQueryEnabled,
        // A paused query would hold the review's spinner until the device
        // reads as online; failing fast shows the call as not looked up.
        networkMode: 'always',
        retry: false,
        staleTime: STALE_TIME_MS,
    })
    return {
        data: query.data,
        isPending: isQueryEnabled && query.isPending,
        isError: query.isError,
    }
}
