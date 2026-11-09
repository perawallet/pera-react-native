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
import { isAddress } from 'viem'
import {
    isEvmChainId,
    type ChainScope,
} from '@perawallet/wallet-core-chain-contract'
import type { Nullable, Optional } from '@perawallet/wallet-core-shared'
import { evmChainOf } from '../../chains/table'
import { fetchEvmContractMetadata } from '../api/endpoints'
import type { EvmContractMetadata } from '../types'
import { CONTRACT_CACHE_TIME_MS, contractQueryKey } from './querykeys'

export type UseEvmContractMetadataQueryParams = {
    scope: ChainScope
    /** Requester-supplied, so anything that isn't an address is never looked up. */
    address: Optional<string>
    isEnabled: boolean
}

export type UseEvmContractMetadataQueryResult = {
    /** Null for a contract Pera doesn't vouch for, and while the lookup is pending or failed. */
    data: Nullable<EvmContractMetadata>
    isPending: boolean
}

export const useEvmContractMetadataQuery = ({
    scope,
    address,
    isEnabled,
}: UseEvmContractMetadataQueryParams): UseEvmContractMetadataQueryResult => {
    const isQueryEnabled =
        isEnabled &&
        !!address &&
        isAddress(address, { strict: false }) &&
        isEvmChainId(scope.chainId)
    const query = useQuery({
        queryKey: contractQueryKey('metadata', scope, address ?? ''),
        queryFn: () => {
            if (
                !address ||
                !isAddress(address, { strict: false }) ||
                !isEvmChainId(scope.chainId)
            ) {
                throw new Error('A contract lookup needs an EVM contract')
            }
            return fetchEvmContractMetadata(
                scope,
                evmChainOf(scope.chainId),
                address,
            )
        },
        enabled: isQueryEnabled,
        // As the ABI lookup: a paused query would hold the bundled label until
        // the device reads as online.
        networkMode: 'always',
        retry: false,
        staleTime: CONTRACT_CACHE_TIME_MS,
        gcTime: CONTRACT_CACHE_TIME_MS,
    })
    return {
        data: query.data ?? null,
        isPending: isQueryEnabled && query.isPending,
    }
}
